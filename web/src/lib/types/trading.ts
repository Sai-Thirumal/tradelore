export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonRecord = Record<string, JsonValue>;

export type TradeDirection = 'LONG' | 'SHORT';
export type TradeResult = 'win' | 'loss' | 'breakeven';
export type OrderType = 'BUY' | 'SELL';
export type InstrumentType = 'EQ' | 'FUT' | 'CE' | 'PE' | '';
export type CommodityClass = 'agricultural' | 'non_agricultural' | '';
export type CalculationStatus = 'exact' | 'estimated';

export interface TradeOrder {
  uid: string;
  symbol: string;
  exchange?: string;
  segment?: string;
  expiry_date?: string;
  instrument_token?: number;
  instrument_name?: string;
  instrument_type?: InstrumentType;
  strike?: number;
  lot_size?: number;
  price_multiplier?: number;
  commodity_class?: CommodityClass;
  metadata_source?: string;
  trade_time: string;
  trade_date?: string;
  order_id?: string;
  trade_id?: string;
  type: OrderType;
  qty: number;
  price: number;
  user_id?: string;
}

export interface TradeRecord {
  id?: string;
  symbol: string;
  exchange?: string;
  segment?: string;
  expiry_date?: string;
  instrument_name?: string;
  instrument_type?: InstrumentType;
  strike?: number;
  lot_size?: number;
  price_multiplier?: number;
  commodity_class?: CommodityClass;
  calculation_status?: CalculationStatus;
  calculation_warnings?: string[];
  direction: TradeDirection;
  qty: number;
  quantity?: number;
  avg_entry: number;
  avgEntry?: number;
  avg_exit: number;
  avgExit?: number;
  pnl: number;
  commission?: number | null;
  commission_breakdown?: unknown;
  entry_time: string;
  entryTime?: string;
  exit_time: string;
  exitTime?: string;
  trade_date: string;
  date?: string;
  result: TradeResult;
  orders?: TradeOrder[];
  user_id?: string;
}

export interface TradeJournalRecord {
  trade_id: string;
  risk_amount?: number | null;
  profit_target_entry?: number | null;
  profit_target_exit?: number | null;
  position_sizing?: string | null;
  playbook_id?: string | null;
  what_worked?: string | null;
  what_didnt?: string | null;
  lessons_learned?: string | null;
  emotions?: string | null;
  important_notes?: string | null;
  user_id?: string;
}

export interface PlaybookRecord {
  id?: string;
  name: string;
  data?: JsonRecord;
  is_default?: boolean;
  user_id?: string | null;
}
