import type { JsonRecord } from '@/lib/types/trading';
import {
  RequestValidationError,
  assertPlainObject,
  optionalKnownString,
  optionalNumber,
  optionalString,
  optionalStringArray,
  rejectUnknownFields,
  requiredString,
} from './request';

const PLAYBOOK_NAME_CHAR_LIMIT = 80;
const PLAYBOOK_WORD_LIMIT = 500;

const MARKETS = ['Stocks', 'Indices', 'Options', 'Futures'] as const;
const TIMEFRAMES = ['5m', '15m', '1h', '4h', 'daily'] as const;
const ENTRY_TYPES = ['limit', 'market', 'stop'] as const;
const STOP_TYPES = ['fixed', 'ATR', 'structure'] as const;
const GRADES = ['A+', 'B'] as const;
const ENVIRONMENTS = ['trending', 'ranging', 'volatile', 'low volatility'] as const;

const TOP_LEVEL_CREATE_FIELDS = ['name', 'data'] as const;
const TOP_LEVEL_UPDATE_FIELDS = ['id', 'name', 'data'] as const;

const PLAYBOOK_DATA_FIELDS = [
  'markets',
  'timeframes',
  'trading_style',
  'market_environment',
  'best_session',
  'macro_invalidation',
  'entry_trigger',
  'entry_confirmation',
  'entry_filters',
  'entry_type',
  'stop_placement',
  'stop_type',
  'stop_invalidation',
  'target_1',
  'target_2',
  'min_rr',
  'scale_out',
  'trailing_stop',
  'early_exit_rule',
  'risk_percent',
  'grade',
  'grade_a_plus',
  'grade_b',
  'ideal_chart',
  'failure_conditions',
  'psychology_notes',
  'common_mistakes',
] as const;

const SHORT_TEXT_FIELDS = [
  'trading_style',
  'best_session',
  'min_rr',
  'ideal_chart',
] as const;

const LONG_TEXT_FIELDS = [
  'macro_invalidation',
  'entry_trigger',
  'entry_confirmation',
  'entry_filters',
  'stop_placement',
  'stop_invalidation',
  'target_1',
  'target_2',
  'scale_out',
  'trailing_stop',
  'early_exit_rule',
  'grade_a_plus',
  'grade_b',
  'failure_conditions',
  'psychology_notes',
  'common_mistakes',
] as const;

export interface PlaybookPayload {
  id?: string;
  name?: string;
  data?: JsonRecord;
}

export function validateCreatePlaybookPayload(body: Record<string, unknown>): { name: string; data?: JsonRecord } {
  rejectUnknownFields(body, TOP_LEVEL_CREATE_FIELDS);

  return {
    name: requiredString(body, 'name', { maxChars: PLAYBOOK_NAME_CHAR_LIMIT }),
    data: validatePlaybookData(body.data),
  };
}

export function validateUpdatePlaybookPayload(body: Record<string, unknown>): PlaybookPayload & { id: string } {
  rejectUnknownFields(body, TOP_LEVEL_UPDATE_FIELDS);
  const name = optionalString(body, 'name', { maxChars: PLAYBOOK_NAME_CHAR_LIMIT });
  if (body.name !== undefined && !name) {
    throw new RequestValidationError('name is required');
  }

  return {
    id: requiredString(body, 'id', { maxChars: 100 }),
    name,
    data: validatePlaybookData(body.data),
  };
}

function validatePlaybookData(data: unknown): JsonRecord | undefined {
  if (data === undefined || data === null) return undefined;
  const body = assertPlainObject(data, 'data');
  rejectUnknownFields(body, PLAYBOOK_DATA_FIELDS);

  const output: JsonRecord = {};

  setIfDefined(output, 'markets', optionalStringArray(body, 'markets', MARKETS));
  setIfDefined(output, 'timeframes', optionalStringArray(body, 'timeframes', TIMEFRAMES));
  setIfDefined(output, 'market_environment', optionalKnownString(body, 'market_environment', ENVIRONMENTS));
  setIfDefined(output, 'entry_type', optionalKnownString(body, 'entry_type', ENTRY_TYPES));
  setIfDefined(output, 'stop_type', optionalKnownString(body, 'stop_type', STOP_TYPES));
  setIfDefined(output, 'grade', optionalKnownString(body, 'grade', GRADES));
  setIfDefined(output, 'risk_percent', optionalNumber(body, 'risk_percent', { min: 0, max: 100 }));

  for (const field of SHORT_TEXT_FIELDS) {
    setIfDefined(output, field, optionalString(body, field, { maxChars: 100, allowEmpty: true }));
  }

  for (const field of LONG_TEXT_FIELDS) {
    setIfDefined(output, field, optionalString(body, field, { maxWords: PLAYBOOK_WORD_LIMIT, allowEmpty: true }));
  }

  for (const key of Object.keys(output)) {
    const value = output[key];
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new RequestValidationError(`${key} must be a valid number`);
    }
  }

  return output;
}

function setIfDefined(output: JsonRecord, key: string, value: JsonRecord[string] | undefined) {
  if (value !== undefined) {
    output[key] = value;
  }
}
