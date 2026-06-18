import type { TradeJournalRecord } from '@/lib/types/trading';
import {
  RequestValidationError,
  optionalNumber,
  optionalString,
  rejectUnknownFields,
  requiredString,
} from './request';

const JOURNAL_WORD_LIMIT = 500;
const MAX_MONEY_VALUE = 1_000_000_000;

const DAILY_JOURNAL_FIELDS = [
  'date',
  'market_outlook',
  'outlook_bias',
  'capital_to_deploy',
  'playbooks_planned',
  'key_levels',
  'news_events',
  'pre_market_notes',
] as const;

const TRADE_JOURNAL_FIELDS = [
  'trade_id',
  'risk_amount',
  'profit_target_entry',
  'profit_target_exit',
  'position_sizing',
  'playbook_id',
  'what_worked',
  'what_didnt',
  'lessons_learned',
  'emotions',
  'important_notes',
] as const;

export interface DailyJournalPayload {
  date: string;
  market_outlook?: string;
  outlook_bias?: string;
  capital_to_deploy?: number | null;
  playbooks_planned?: string;
  key_levels?: string;
  news_events?: string;
  pre_market_notes?: string;
}

export function validateDailyJournalPayload(body: Record<string, unknown>): DailyJournalPayload {
  rejectUnknownFields(body, DAILY_JOURNAL_FIELDS);
  const date = requiredString(body, 'date', { maxChars: 10 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RequestValidationError('date must use YYYY-MM-DD format');
  }

  return {
    date,
    market_outlook: optionalJournalString(body, 'market_outlook'),
    outlook_bias: optionalJournalString(body, 'outlook_bias'),
    capital_to_deploy: optionalNumber(body, 'capital_to_deploy', { min: 0, max: MAX_MONEY_VALUE }),
    playbooks_planned: optionalJournalString(body, 'playbooks_planned'),
    key_levels: optionalJournalString(body, 'key_levels'),
    news_events: optionalJournalString(body, 'news_events'),
    pre_market_notes: optionalJournalString(body, 'pre_market_notes'),
  };
}

export function validateTradeJournalPayload(body: Record<string, unknown>): TradeJournalRecord {
  rejectUnknownFields(body, TRADE_JOURNAL_FIELDS);

  return {
    trade_id: requiredString(body, 'trade_id', { maxChars: 200 }),
    risk_amount: optionalNumber(body, 'risk_amount', { min: 0, max: MAX_MONEY_VALUE }),
    profit_target_entry: optionalNumber(body, 'profit_target_entry', { min: 0, max: MAX_MONEY_VALUE }),
    profit_target_exit: optionalNumber(body, 'profit_target_exit', { min: 0, max: MAX_MONEY_VALUE }),
    position_sizing: optionalJournalString(body, 'position_sizing'),
    playbook_id: optionalJournalString(body, 'playbook_id'),
    what_worked: optionalJournalString(body, 'what_worked'),
    what_didnt: optionalJournalString(body, 'what_didnt'),
    lessons_learned: optionalJournalString(body, 'lessons_learned'),
    emotions: optionalJournalString(body, 'emotions'),
    important_notes: optionalJournalString(body, 'important_notes'),
  };
}

function optionalJournalString(body: Record<string, unknown>, field: string) {
  return optionalString(body, field, { maxWords: JOURNAL_WORD_LIMIT, allowEmpty: true });
}
