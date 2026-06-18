// Indian exchange commission calculator
// Formulas match the exact spec provided by the user (Apr 2026 rates)

export interface CommissionBreakdown {
  brokerage: number;       // Broker commission
  stt: number;             // Securities Transaction Tax (or CTT for commodities)
  exchangeCharge: number;  // Exchange transaction charge
  sebiFee: number;         // SEBI turnover fee
  stampDuty: number;       // Stamp duty (buy side only)
  dpCharge: number;        // Depository charge (delivery sell only)
  gst: number;             // GST on brokerage + exchange + SEBI
  total: number;           // Sum of all above
}

// ── Rate tables ──

// STT / CTT rates (revised Apr 2026)
// Note: STT/CTT is always on TURNOVER VALUE, never on profit.
const STT_RATES: Record<string, { rate: number; sellOnly: boolean }> = {
  'EQ_DELIVERY':   { rate: 0.001,   sellOnly: false }, // 0.1% both sides
  'EQ_INTRADAY':   { rate: 0.00025, sellOnly: true  }, // 0.025% sell only
  'FO_FUTURES':    { rate: 0.0005,  sellOnly: true  }, // 0.05% sell only (Apr 2026)
  'FO_OPTIONS':    { rate: 0.0015,  sellOnly: true  }, // 0.15% premium sell (Apr 2026)
  'FO_OPTIONS_EX': { rate: 0.0015,  sellOnly: true  }, // 0.15% intrinsic value at exercise
  'MCX_FUTURES':   { rate: 0.0001,  sellOnly: true  }, // CTT 0.01% sell only
  'MCX_OPTIONS':   { rate: 0.0005,  sellOnly: true  }, // CTT 0.05% sell premium
};

// Exchange transaction charges (₹ per lakh of turnover / premium)
const EXCHANGE_RATES: Record<string, number> = {
  'NSE_EQ':      2.97,  // ₹2.97 per lakh (each side)
  'NSE_FUTURES': 1.73,  // ₹1.73 per lakh (each side)
  'NSE_OPTIONS': 35.03, // ₹35.03 per lakh of premium (each side)
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

// GST rate
const GST_RATE = 0.18;

// DP charges: flat per ISIN per day on sell (₹13.5 + 18% GST = ₹15.93)
const DP_CHARGE_PER_ISIN = 15.93;

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

  if (seg === 'EQ') return 'NSE_EQ';
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
      // Equity intraday: min(20, 0.03% of total trade turnover)
      // Per-leg we can't know total turnover, so caller handles this.
      // Default to 0 here; calculateTradeCommission sets the correct value.
      brokerage = 0;
    } else {
      // F&O / MCX: ₹20 per executed order per leg
      brokerage = 20;
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
    if (sttRate.sellOnly && !isSell) {
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
  const sebiFee = turnover * SEBI_RATE;

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

  // 6. DP charge (delivery sell only)
  let dpCharge = 0;
  if (seg === 'EQ' && isDelivery && isSell) {
    dpCharge = DP_CHARGE_PER_ISIN;
  }

  // 7. GST (18% on brokerage + exchange charge + SEBI fee ONLY)
  // Do NOT apply GST on STT, CTT, or stamp duty.
  const gstBase = brokerage + exchangeCharge + sebiFee;
  const gst = gstBase * GST_RATE;

  const total = brokerage + stt + exchangeCharge + sebiFee + stampDuty + dpCharge + gst;

  return {
    brokerage: round(brokerage),
    stt: round(stt),
    exchangeCharge: round(exchangeCharge),
    sebiFee: round(sebiFee),
    stampDuty: round(stampDuty),
    dpCharge: round(dpCharge),
    gst: round(gst),
    total: round(total),
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
  direction: 'LONG' | 'SHORT';
  qty: number;
  avg_entry: number;
  avg_exit: number;
  entry_time: string;
  exit_time: string;
}): CommissionBreakdown {
  const { symbol, exchange, segment, direction, qty, avg_entry, avg_exit, entry_time, exit_time } = trade;

  const upperSymbol = (symbol || '').toUpperCase();
  const isOptions = upperSymbol.endsWith('CE') || upperSymbol.endsWith('PE');
  const seg = (segment || '').toUpperCase();
  const isMCX = (exchange || '').toUpperCase() === 'MCX' || seg === 'MCX';

  // Turnover values
  const entryTurnover = qty * avg_entry;
  const exitTurnover = qty * avg_exit;
  const totalTurnover = entryTurnover + exitTurnover;

  // For equity delivery vs intraday: infer from hold time
  const entryDate = entry_time.substring(0, 10);
  const exitDate = exit_time.substring(0, 10);
  const isDelivery = entryDate !== exitDate;

  // ── Brokerage calculation per spec ──
  let entryBrokerage = 0;
  let exitBrokerage = 0;

  if (seg === 'EQ' && !isDelivery && !isMCX) {
    // Equity intraday: min(20, 0.03% of total turnover) for the WHOLE trade
    const specBrokerage = Math.min(20, 0.0003 * totalTurnover);
    entryBrokerage = specBrokerage;
    exitBrokerage = 0; // all brokerage assigned to entry leg
  } else if (seg === 'EQ' && isDelivery) {
    // Equity delivery: ₹0
    entryBrokerage = 0;
    exitBrokerage = 0;
  } else {
    // F&O / MCX: ₹20 per executed order × 2 legs
    entryBrokerage = 20;
    exitBrokerage = 20;
  }

  // Entry leg: buy for LONG, sell for SHORT
  const entryCommission = calculateLegCommission({
    turnover: entryTurnover,
    segment,
    exchange,
    isOptions,
    isSell: direction === 'SHORT',
    isBuy: direction === 'LONG',
    isDelivery,
    brokeragePerOrder: entryBrokerage,
  });

  // Exit leg: sell for LONG, buy for SHORT
  const exitCommission = calculateLegCommission({
    turnover: exitTurnover,
    segment,
    exchange,
    isOptions,
    isSell: direction === 'LONG',
    isBuy: direction === 'SHORT',
    isDelivery,
    brokeragePerOrder: exitBrokerage,
  });

  // Sum both legs
  return sumCommissions(entryCommission, exitCommission);
}

function sumCommissions(a: CommissionBreakdown, b: CommissionBreakdown): CommissionBreakdown {
  return {
    brokerage: round(a.brokerage + b.brokerage),
    stt: round(a.stt + b.stt),
    exchangeCharge: round(a.exchangeCharge + b.exchangeCharge),
    sebiFee: round(a.sebiFee + b.sebiFee),
    stampDuty: round(a.stampDuty + b.stampDuty),
    dpCharge: round(a.dpCharge + b.dpCharge),
    gst: round(a.gst + b.gst),
    total: round(a.total + b.total),
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
    brokerage: round(brokerage),
    stt: round(stt),
    exchangeCharge: round(exchangeCharge),
    sebiFee: round(sebiFee),
    stampDuty: round(stampDuty),
    dpCharge: 0,
    gst: round(gst),
    total: round(total),
  };
}
