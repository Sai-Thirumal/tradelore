import type {
  CalculationStatus,
  CommodityClass,
  InstrumentType,
  TradeOrder,
  TradeRecord,
} from '@/lib/types/trading';

export interface McxContractSpec {
  family: string;
  displayFamily: string;
  priceMultiplier: number;
  commodityClass: CommodityClass;
  specificationSource: string;
}

export interface McxMetadata {
  instrumentName: string;
  instrumentType: InstrumentType;
  priceMultiplier: number;
  commodityClass: CommodityClass;
  calculationStatus: CalculationStatus;
  warnings: string[];
  specificationSource: string;
}

const MCX_SPEC_SOURCE = 'mcx-contract-catalog-2026-06-25';

// Price multiplier converts one exchange quantity at the quoted price into
// rupee contract value. It is deliberately separate from Kite's lot_size,
// which is the order-quantity step and is commonly 1 for MCX instruments.
const CONTRACT_SPECS: Record<string, Omit<McxContractSpec, 'family'>> = {
  GOLD: { displayFamily: 'Gold', priceMultiplier: 100, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  GOLDM: { displayFamily: 'Gold', priceMultiplier: 10, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  GOLDTEN: { displayFamily: 'Gold', priceMultiplier: 1, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  GOLDGUINEA: { displayFamily: 'Gold', priceMultiplier: 1, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  GOLDPETAL: { displayFamily: 'Gold', priceMultiplier: 1, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  SILVER: { displayFamily: 'Silver', priceMultiplier: 30, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  SILVERM: { displayFamily: 'Silver', priceMultiplier: 5, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  SILVERMIC: { displayFamily: 'Silver', priceMultiplier: 1, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  SILVER100: { displayFamily: 'Silver', priceMultiplier: 1, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  CRUDEOIL: { displayFamily: 'Crude Oil', priceMultiplier: 100, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  CRUDEOILM: { displayFamily: 'Crude Oil', priceMultiplier: 10, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  NATURALGAS: { displayFamily: 'Natural Gas', priceMultiplier: 1250, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  NATGASMINI: { displayFamily: 'Natural Gas', priceMultiplier: 250, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  COPPER: { displayFamily: 'Copper', priceMultiplier: 2500, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  ALUMINIUM: { displayFamily: 'Aluminium', priceMultiplier: 5000, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  ALUMINI: { displayFamily: 'Aluminium', priceMultiplier: 1000, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  LEAD: { displayFamily: 'Lead', priceMultiplier: 5000, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  LEADMINI: { displayFamily: 'Lead', priceMultiplier: 1000, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  ZINC: { displayFamily: 'Zinc', priceMultiplier: 5000, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  ZINCMINI: { displayFamily: 'Zinc', priceMultiplier: 1000, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  NICKEL: { displayFamily: 'Nickel', priceMultiplier: 1500, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
  MENTHAOIL: { displayFamily: 'Mentha Oil', priceMultiplier: 360, commodityClass: 'agricultural', specificationSource: MCX_SPEC_SOURCE },
  CARDAMOM: { displayFamily: 'Cardamom', priceMultiplier: 100, commodityClass: 'agricultural', specificationSource: MCX_SPEC_SOURCE },
  KAPAS: { displayFamily: 'Kapas', priceMultiplier: 200, commodityClass: 'agricultural', specificationSource: MCX_SPEC_SOURCE },
  STEELREBAR: { displayFamily: 'Steel Rebar', priceMultiplier: 5, commodityClass: 'non_agricultural', specificationSource: MCX_SPEC_SOURCE },
};

const MONTH_CODE = '(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)';

export function isMcxInstrument(value: Pick<TradeOrder, 'exchange' | 'segment'> | Pick<TradeRecord, 'exchange' | 'segment'>): boolean {
  return (value.exchange || '').toUpperCase() === 'MCX'
    || (value.segment || '').toUpperCase().startsWith('MCX');
}

export function extractMcxInstrumentName(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  return upper
    .replace(new RegExp(`\\d{2}${MONTH_CODE}FUT$`), '')
    .replace(new RegExp(`\\d{2}${MONTH_CODE}\\d+(?:\\.\\d+)?(?:CE|PE)$`), '')
    .replace(/\d{2}[1-9OND]\d{2}\d+(?:\.\d+)?(?:CE|PE)$/, '')
    || upper;
}

export function inferInstrumentType(symbol: string): InstrumentType {
  const upper = symbol.trim().toUpperCase();
  if (upper.endsWith('FUT')) return 'FUT';
  if (upper.endsWith('CE')) return 'CE';
  if (upper.endsWith('PE')) return 'PE';
  return '';
}

export function getMcxContractSpec(symbolOrName: string): McxContractSpec | null {
  const family = extractMcxInstrumentName(symbolOrName);
  const spec = CONTRACT_SPECS[family];
  return spec ? { family, ...spec } : null;
}

export function enrichMcxMetadata(
  symbol: string,
  supplied: Partial<Pick<TradeOrder, 'instrument_name' | 'instrument_type' | 'price_multiplier' | 'commodity_class' | 'metadata_source'>>,
): McxMetadata {
  const instrumentName = supplied.instrument_name || extractMcxInstrumentName(symbol);
  const spec = getMcxContractSpec(instrumentName);
  const suppliedMultiplier = Number(supplied.price_multiplier || 0);
  const suppliedMultiplierIsAuthoritative = suppliedMultiplier > 0 && Boolean(
    supplied.metadata_source
    || !spec
    || suppliedMultiplier === spec.priceMultiplier,
  );
  const priceMultiplier = suppliedMultiplierIsAuthoritative
    ? suppliedMultiplier
    : spec?.priceMultiplier || suppliedMultiplier || 1;
  const warnings: string[] = [];

  if (!suppliedMultiplierIsAuthoritative && !spec) {
    warnings.push(`Unknown MCX contract multiplier for ${instrumentName}; calculations use 1x.`);
  }

  const commodityClass = supplied.commodity_class || spec?.commodityClass || '';
  if (!commodityClass) {
    warnings.push(`Unknown agricultural classification for ${instrumentName}; non-agricultural charges are estimated.`);
  }

  return {
    instrumentName,
    instrumentType: supplied.instrument_type || inferInstrumentType(symbol),
    priceMultiplier,
    commodityClass,
    calculationStatus: warnings.length ? 'estimated' : 'exact',
    warnings,
    specificationSource: supplied.metadata_source || spec?.specificationSource || 'fallback',
  };
}

export function getContractValue(quantity: number, price: number, priceMultiplier = 1): number {
  return Math.abs(Number(quantity) * Number(price) * Math.max(Number(priceMultiplier) || 1, 1));
}

export function getMcxFamilyLabel(symbolOrName: string): string {
  const spec = getMcxContractSpec(symbolOrName);
  return spec?.displayFamily || extractMcxInstrumentName(symbolOrName);
}

export function getMcxSessionCloseMinutes(date: Date): number {
  // MCX evening close follows the US daylight-saving calendar.
  const year = date.getFullYear();
  const secondSundayInMarch = new Date(year, 2, 1);
  secondSundayInMarch.setDate(1 + ((7 - secondSundayInMarch.getDay()) % 7) + 7);
  const firstSundayInNovember = new Date(year, 10, 1);
  firstSundayInNovember.setDate(1 + ((7 - firstSundayInNovember.getDay()) % 7));
  const isUsDaylightSaving = date >= secondSundayInMarch && date < firstSundayInNovember;
  return isUsDaylightSaving ? 23 * 60 + 55 : 23 * 60 + 30;
}

export function getMcxYahooSymbol(symbolOrName: string): string | null {
  const family = getMcxContractSpec(symbolOrName)?.family || extractMcxInstrumentName(symbolOrName);
  const symbols: Record<string, string> = {
    GOLD: 'GC=F',
    GOLDM: 'GC=F',
    GOLDTEN: 'GC=F',
    GOLDGUINEA: 'GC=F',
    GOLDPETAL: 'GC=F',
    SILVER: 'SI=F',
    SILVERM: 'SI=F',
    SILVERMIC: 'SI=F',
    SILVER100: 'SI=F',
    CRUDEOIL: 'CL=F',
    CRUDEOILM: 'CL=F',
    NATURALGAS: 'NG=F',
    NATGASMINI: 'NG=F',
    COPPER: 'HG=F',
  };
  return symbols[family] || null;
}
