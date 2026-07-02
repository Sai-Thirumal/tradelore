// Indian exchange commission calculator for Zerodha charges.

import type { TradeDirection, TradeOrder, TradeRecord } from '@/lib/types/trading';
import { enrichMcxMetadata, getContractValue, isMcxInstrument } from './mcx.ts';

export const COMMISSION_RATE_VERSION = 'zerodha_charges_2026_06_19_no_dp';

export interface CommissionBreakdown {
  rateVersion: string;
  brokerage: number;       // Broker commission
  stt: number;             // Securities Transaction Tax (or CTT for commodities)
  exchangeCharge: number;  // Exchange transaction charge
  sebiFee: number;         // SEBI turnover fee
  stampDuty: number;       // Stamp duty (buy side only)
  dpCharge: number;        // Depository charge (delivery sell only)
  gst: number;             // GST on brokerage + exchange + SEBI
  total: number;           // Sum of all above
  calculationStatus: 'exact' | 'estimated';
  warnings: string[];
}

// ── Rate tables ──

// STT / CTT rates
// Note: STT/CTT is always on TURNOVER VALUE, never on profit.
const STT_RATES: Record<string, { rate: number; sellOnly: boolean }> = {
  'EQ_DELIVERY':   { rate: 0.001,   sellOnly: false }, // 0.1% both sides
  'EQ_INTRADAY':   { rate: 0.00025, sellOnly: true  }, // 0.025% sell only
  'FO_FUTURES':    { rate: 0.0005,  sellOnly: true  }, // 0.05% sell only
  'FO_OPTIONS':    { rate: 0.0015,  sellOnly: true  }, // 0.15% premium sell
  'FO_OPTIONS_EX': { rate: 0.0015,  sellOnly: true  }, // 0.15% intrinsic value at exercise
  'MCX_FUTURES':   { rate: 0.0001,  sellOnly: true  }, // CTT 0.01% sell only
  'MCX_OPTIONS':   { rate: 0.0005,  sellOnly: true  }, // CTT 0.05% sell premium
};

// Exchange transaction charges (₹ per lakh of turnover / premium)
const EXCHANGE_RATES: Record<string, number> = {
  'NSE_EQ':      3.07,  // ₹3.07 per lakh (each side)
  'BSE_EQ':      3.75,  // ₹3.75 per lakh (each side)
  'NSE_FUTURES': 1.83,  // ₹1.83 per lakh (each side)
  'BSE_FUTURES': 0,     // ₹0 per lakh (each side)
  'NSE_OPTIONS': 35.53, // ₹35.53 per lakh of premium (each side)
  'BSE_OPTIONS': 32.50, // ₹32.50 per lakh of premium (each side)
  'MCX_FUTURES': 2.10,  // ₹2.10 per lakh turnover
  'MCX_OPTIONS': 41.80, // ₹41.80 per lakh premium turnover
};

// Stamp duty rates (buy side only)
const STAMP_DUTY_RATES: Record<string, number> = {
  'EQ_DELIVERY': 0.00015,  // 0.015%
  'EQ_INTRADAY': 0.00003,  // 0.003%
  'FO_FUTURES':  0.00002,   // 0.002%
  'FO_OPTIONS':  0.00003,   // 0.003%
  'MCX_FUTURES': 0.00002,   // 0.002%
  'MCX_OPTIONS': 0.00003,   // 0.003%
};

// SEBI turnover fee: ₹10 per crore = 0.0001% = 0.000001
const SEBI_RATE = 0.000001;
const AGRI_SEBI_RATE = 0.0000001;
const CURRENT_RATE_EFFECTIVE_DATE = '2026-06-19';

// GST rate
const GST_RATE = 0.18;

// ── Helpers ──

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function getSttKey(segment: string, isSell: boolean, isOptions: boolean, isExercise: boolean, exchange: string): string {
  const seg = (segment || '').toUpperCase();
  const ex = (exchange || '').toUpperCase();

  if (ex === 'MCX' || seg === 'MCX') {
    return isOptions ? 'MCX_OPTIONS' : 'MCX_FUTURES';
  }

  if (seg === 'EQ') {
    // Delivery vs intraday distinction is passed via isDelivery in caller
    // This function only resolves the key; the caller decides EQ_DELIVERY vs EQ_INTRADAY
    return 'EQ_DELIVERY'; // default, overridden by caller when isIntraday=true
  }

  if (seg === 'FO' || seg === 'NFO' || seg === 'BFO') {
    if (isExercise) return 'FO_OPTIONS_EX';
    return isOptions ? 'FO_OPTIONS' : 'FO_FUTURES';
  }

  return 'EQ_DELIVERY';
}

function getExchangeKey(exchange: string, segment: string, isOptions: boolean): string {
  const ex = (exchange || '').toUpperCase();
  const seg = (segment || '').toUpperCase();

  if (ex === 'MCX' || seg === 'MCX') {
    return isOptions ? 'MCX_OPTIONS' : 'MCX_FUTURES';
  }

  if (seg === 'EQ') return ex === 'BSE' ? 'BSE_EQ' : 'NSE_EQ';
  if (ex === 'BFO' || seg === 'BFO' || ex === 'BSE') {
    return isOptions ? 'BSE_OPTIONS' : 'BSE_FUTURES';
  }
  if (isOptions) return 'NSE_OPTIONS';
  return 'NSE_FUTURES';
}

function getStampDutyKey(segment: string, isOptions: boolean, exchange: string): string {
  const seg = (segment || '').toUpperCase();
  const ex = (exchange || '').toUpperCase();

  if (ex === 'MCX' || seg === 'MCX') {
    return isOptions ? 'MCX_OPTIONS' : 'MCX_FUTURES';
  }

  if (seg === 'EQ') return 'EQ_DELIVERY'; // overridden by caller for intraday
  if (isOptions) return 'FO_OPTIONS';
  return 'FO_FUTURES';
}

// ── Core calculator (per-leg) ──

interface CommissionParams {
  turnover: number;        // turnover for THIS leg
  segment: string;
  exchange: string;
  isOptions?: boolean;
  isSell?: boolean;
  isBuy?: boolean;
  isDelivery?: boolean;
  isExercise?: boolean;
  brokeragePerOrder?: number;
  commodityClass?: string;
  tradeDate?: string;
  warnings?: string[];
}

function calculateLegCommission(params: CommissionParams): CommissionBreakdown {
  const {
    turnover,
    segment,
    exchange,
    isOptions = false,
    isSell = true,
    isBuy = true,
    isDelivery = false,
    isExercise = false,
    brokeragePerOrder,
    commodityClass = '',
    tradeDate = '',
    warnings = [],
  } = params;

  const seg = (segment || '').toUpperCase();
  const isMCX = (exchange || '').toUpperCase() === 'MCX' || seg === 'MCX';

  // 1. Brokerage
  let brokerage = 0;
  if (brokeragePerOrder !== undefined) {
    brokerage = brokeragePerOrder;
  } else {
    if (seg === 'EQ' && isDelivery) {
      brokerage = 0;
    } else if (seg === 'EQ' && !isDelivery) {
      brokerage = Math.min(20, 0.0003 * turnover);
    } else if (isOptions) {
      brokerage = 20;
    } else {
      brokerage = Math.min(20, 0.0003 * turnover);
    }
  }

  // 2. STT / CTT
  let stt = 0;
  let sttKey = getSttKey(segment, isSell, isOptions, isExercise, exchange);

  // Override for equity intraday
  if (seg === 'EQ' && !isDelivery && !isMCX) {
    sttKey = 'EQ_INTRADAY';
  }

  const sttRate = STT_RATES[sttKey];
  if (sttRate) {
    if (isMCX && commodityClass === 'agricultural' && !isOptions) {
      stt = 0;
    } else if (sttRate.sellOnly && !isSell) {
      stt = 0;
    } else {
      stt = turnover * sttRate.rate;
    }
  }

  // 3. Exchange transaction charge
  const exKey = getExchangeKey(exchange, segment, isOptions);
  const exRatePerLakh = EXCHANGE_RATES[exKey] || 2.97;
  const exchangeCharge = (turnover / 1_00_000) * exRatePerLakh;

  // 4. SEBI fee
  const sebiRate = isMCX && commodityClass === 'agricultural' ? AGRI_SEBI_RATE : SEBI_RATE;
  const sebiFee = turnover * sebiRate;

  // 5. Stamp duty (buy side only)
  let stampDuty = 0;
  if (isBuy) {
    let sdKey = getStampDutyKey(segment, isOptions, exchange);
    if (seg === 'EQ' && !isDelivery && !isMCX) {
      sdKey = 'EQ_INTRADAY';
    }
    const sdRate = STAMP_DUTY_RATES[sdKey] || 0;
    stampDuty = turnover * sdRate;
  }

  const dpCharge = 0;

  // 7. GST (18% on brokerage + exchange charge + SEBI fee ONLY)
  // Do NOT apply GST on STT, CTT, or stamp duty.
  const gstBase = brokerage + exchangeCharge + sebiFee;
  const gst = gstBase * GST_RATE;

  const total = brokerage + stt + exchangeCharge + sebiFee + stampDuty + dpCharge + gst;
  const rateWarnings = [...warnings];
  if (tradeDate && tradeDate < CURRENT_RATE_EFFECTIVE_DATE) {
    rateWarnings.push(
      `Charges for ${tradeDate} are estimated using the ${CURRENT_RATE_EFFECTIVE_DATE} rate schedule.`,
    );
  }

  return {
    rateVersion: COMMISSION_RATE_VERSION,
    brokerage: round(brokerage),
    stt: round(stt),
    exchangeCharge: round(exchangeCharge),
    sebiFee: round(sebiFee),
    stampDuty: round(stampDuty),
    dpCharge: round(dpCharge),
    gst: round(gst),
    total: round(total),
    calculationStatus: rateWarnings.length ? 'estimated' : 'exact',
    warnings: rateWarnings,
  };
}

// ── Trade-level calculator (entry + exit combined) ──

/**
 * Calculate commission for a complete trade (entry + exit combined).
 * This is the main entry point used by the trade matcher and API routes.
 */
export function calculateTradeCommission(trade: {
  symbol: string;
  exchange: string;
  segment: string;
  direction: TradeDirection;
  qty: number;
  avg_entry: number;
  avg_exit: number;
  entry_time: string;
  exit_time: string;
  orders?: TradeOrder[];
  price_multiplier?: number;
  commodity_class?: string;
  instrument_name?: string;
  instrument_type?: TradeOrder['instrument_type'];
}): CommissionBreakdown {
  const { symbol, exchange, segment, direction, qty, avg_entry, avg_exit, entry_time, exit_time } = trade;

  const upperSymbol = (symbol || '').toUpperCase();
  const isOptions = upperSymbol.endsWith('CE') || upperSymbol.endsWith('PE');
  const seg = (segment || '').toUpperCase();
  const mcxMetadata = isMcxInstrument({ exchange, segment })
    ? enrichMcxMetadata(symbol, {
        price_multiplier: trade.orders?.[0]?.price_multiplier || trade.price_multiplier,
        commodity_class: (trade.orders?.[0]?.commodity_class || trade.commodity_class) as TradeOrder['commodity_class'],
        instrument_name: trade.orders?.[0]?.instrument_name || trade.instrument_name,
        instrument_type: trade.orders?.[0]?.instrument_type || trade.instrument_type,
        metadata_source: trade.orders?.[0]?.metadata_source,
      })
    : null;

  // For equity delivery vs intraday: infer from hold time
  const entryDate = entry_time.substring(0, 10);
  const exitDate = exit_time.substring(0, 10);
  const isDelivery = seg === 'EQ' && entryDate !== exitDate;
  const tradeOrders = trade.orders && trade.orders.length > 0
    ? trade.orders
    : buildFallbackOrders({
        direction,
        qty,
        avg_entry,
        avg_exit,
        exchange,
        segment,
        entry_time,
        exit_time,
        priceMultiplier: trade.price_multiplier || mcxMetadata?.priceMultiplier || 1,
        commodityClass: trade.commodity_class || mcxMetadata?.commodityClass || '',
      });

  return tradeOrders.reduce((sum, order) => {
    const orderSegment = order.segment || segment;
    const orderExchange = order.exchange || exchange;
    const orderMultiplier = Number(mcxMetadata?.priceMultiplier || order.price_multiplier || 1);
    const turnover = getContractValue(Number(order.qty), Number(order.price), orderMultiplier);
    const commission = calculateLegCommission({
      turnover,
      segment: orderSegment,
      exchange: orderExchange,
      isOptions,
      isSell: order.type === 'SELL',
      isBuy: order.type === 'BUY',
      isDelivery,
      commodityClass: order.commodity_class || mcxMetadata?.commodityClass || '',
      tradeDate: order.trade_time.substring(0, 10),
      warnings: mcxMetadata?.warnings || [],
    });
    return sumCommissions(sum, commission);
  }, emptyCommission());
}

function sumCommissions(a: CommissionBreakdown, b: CommissionBreakdown): CommissionBreakdown {
  return {
    rateVersion: COMMISSION_RATE_VERSION,
    brokerage: round(a.brokerage + b.brokerage),
    stt: round(a.stt + b.stt),
    exchangeCharge: round(a.exchangeCharge + b.exchangeCharge),
    sebiFee: round(a.sebiFee + b.sebiFee),
    stampDuty: round(a.stampDuty + b.stampDuty),
    dpCharge: round(a.dpCharge + b.dpCharge),
    gst: round(a.gst + b.gst),
    total: round(a.total + b.total),
    calculationStatus: a.calculationStatus === 'estimated' || b.calculationStatus === 'estimated'
      ? 'estimated'
      : 'exact',
    warnings: [...a.warnings, ...b.warnings].filter(
      (warning, index, warnings) => warnings.indexOf(warning) === index,
    ),
  };
}

function emptyCommission(): CommissionBreakdown {
  return {
    rateVersion: COMMISSION_RATE_VERSION,
    brokerage: 0,
    stt: 0,
    exchangeCharge: 0,
    sebiFee: 0,
    stampDuty: 0,
    dpCharge: 0,
    gst: 0,
    total: 0,
    calculationStatus: 'exact',
    warnings: [],
  };
}

function buildFallbackOrders(params: {
  direction: TradeDirection;
  qty: number;
  avg_entry: number;
  avg_exit: number;
  exchange: string;
  segment: string;
  entry_time: string;
  exit_time: string;
  priceMultiplier: number;
  commodityClass: string;
}): TradeOrder[] {
  const {
    direction, qty, avg_entry, avg_exit, exchange, segment, entry_time, exit_time,
    priceMultiplier, commodityClass,
  } = params;
  const entryType = direction === 'LONG' ? 'BUY' : 'SELL';
  const exitType = direction === 'LONG' ? 'SELL' : 'BUY';

  return [
    {
      uid: 'commission-entry',
      symbol: '',
      exchange,
      segment,
      trade_time: entry_time,
      type: entryType,
      qty,
      price: avg_entry,
      price_multiplier: priceMultiplier,
      commodity_class: commodityClass as TradeOrder['commodity_class'],
    },
    {
      uid: 'commission-exit',
      symbol: '',
      exchange,
      segment,
      trade_time: exit_time,
      type: exitType,
      qty,
      price: avg_exit,
      price_multiplier: priceMultiplier,
      commodity_class: commodityClass as TradeOrder['commodity_class'],
    },
  ];
}

export function isCurrentCommissionBreakdown(value: unknown): value is CommissionBreakdown {
  return typeof value === 'object'
    && value !== null
    && 'rateVersion' in value
    && value.rateVersion === COMMISSION_RATE_VERSION
    && 'calculationStatus' in value
    && 'warnings' in value;
}

export function withCurrentCommission<T extends TradeRecord>(trade: T): T {
  if ((trade.broker || '').toLowerCase() === 'delta') {
    const netPnl = Number(trade.pnl || 0) - Number(trade.commission || 0);
    const result = netPnl > 0.005 ? 'win' : netPnl < -0.005 ? 'loss' : 'breakeven';
    return trade.result === result ? trade : { ...trade, result };
  }

  if (trade.commission !== undefined && trade.commission !== null && isCurrentCommissionBreakdown(trade.commission_breakdown)) {
    const netPnl = Number(trade.pnl || 0) - Number(trade.commission || 0);
    const result = netPnl > 0.005 ? 'win' : netPnl < -0.005 ? 'loss' : 'breakeven';
    return trade.result === result ? trade : { ...trade, result };
  }

  const commission = calculateTradeCommission({
    symbol: trade.symbol || '',
    exchange: trade.exchange || '',
    segment: trade.segment || '',
    direction: trade.direction === 'SHORT' ? 'SHORT' : 'LONG',
    qty: trade.qty || 0,
    avg_entry: trade.avg_entry || 0,
    avg_exit: trade.avg_exit || 0,
    entry_time: trade.entry_time || trade.entryTime || '',
    exit_time: trade.exit_time || trade.exitTime || '',
    orders: trade.orders,
    price_multiplier: trade.price_multiplier,
    commodity_class: trade.commodity_class,
    instrument_name: trade.instrument_name,
    instrument_type: trade.instrument_type,
  });

  return {
    ...trade,
    commission: commission.total,
    commission_breakdown: commission,
    calculation_status: commission.calculationStatus,
    calculation_warnings: commission.warnings,
    result: (trade.pnl || 0) - commission.total > 0.005
      ? 'win'
      : (trade.pnl || 0) - commission.total < -0.005
        ? 'loss'
        : 'breakeven',
  };
}

// ── Exercised options calculator (Segment 4B) ──

/**
 * Calculate commission for an option exercised at expiry (ITM).
 * This is a separate entry point because exercised options have no exit leg.
 *
 * @param params
 *   - strike_price: option strike
 *   - spot_price: spot at expiry
 *   - buy_premium: premium paid per unit
 *   - lot_size: units per lot
 *   - num_lots: number of lots
 *   - option_type: 'CE' | 'PE'
 *   - exchange: 'NSE' | 'BSE'
 *   - segment: 'FO' | 'NFO' | 'BFO'
 */
export function calculateExercisedOptionCommission(params: {
  strike_price: number;
  spot_price: number;
  buy_premium: number;
  lot_size: number;
  num_lots: number;
  option_type: 'CE' | 'PE';
  exchange: string;
  segment: string;
}): CommissionBreakdown {
  const { strike_price, spot_price, buy_premium, lot_size, num_lots, option_type, exchange, segment } = params;

  const totalQty = lot_size * num_lots;

  // Intrinsic value
  let intrinsicValue = 0;
  if (option_type === 'CE') {
    intrinsicValue = Math.max(0, (spot_price - strike_price) * totalQty);
  } else {
    intrinsicValue = Math.max(0, (strike_price - spot_price) * totalQty);
  }

  const buyValue = buy_premium * totalQty;

  // Brokerage: only 1 leg (entry), exercise has no exit brokerage
  const brokerage = 20;

  // STT on intrinsic value at exercise
  const stt = intrinsicValue * 0.0015;

  // Exchange transaction charge on buy premium only
  const exKey = getExchangeKey(exchange, segment, true);
  const exRatePerLakh = EXCHANGE_RATES[exKey] || 35.03;
  const exchangeCharge = (buyValue / 1_00_000) * exRatePerLakh;

  // SEBI on buy premium
  const sebiFee = buyValue * SEBI_RATE;

  // Stamp duty on buy side
  const stampDuty = buyValue * 0.00003;

  // GST on brokerage + exchange + SEBI
  const gstBase = brokerage + exchangeCharge + sebiFee;
  const gst = gstBase * GST_RATE;

  const total = brokerage + stt + exchangeCharge + sebiFee + stampDuty + gst;

  return {
    rateVersion: COMMISSION_RATE_VERSION,
    brokerage: round(brokerage),
    stt: round(stt),
    exchangeCharge: round(exchangeCharge),
    sebiFee: round(sebiFee),
    stampDuty: round(stampDuty),
    dpCharge: 0,
    gst: round(gst),
    total: round(total),
    calculationStatus: 'exact',
    warnings: [],
  };
}
