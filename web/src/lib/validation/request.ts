import { NextResponse } from 'next/server';

export class RequestValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestValidationError';
    this.status = status;
  }
}

export function validationErrorResponse(error: unknown) {
  if (error instanceof RequestValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

export function assertPlainObject(value: unknown, label = 'Body'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RequestValidationError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

export async function readJsonObject(request: Request) {
  try {
    return assertPlainObject(await request.json());
  } catch (error) {
    if (error instanceof RequestValidationError) throw error;
    throw new RequestValidationError('Invalid JSON body');
  }
}

export function rejectUnknownFields(body: Record<string, unknown>, allowedFields: readonly string[]) {
  const allowed = new Set(allowedFields);
  const unknown = Object.keys(body).filter(key => !allowed.has(key));
  if (unknown.length) {
    throw new RequestValidationError(`Invalid field: ${unknown[0]}`);
  }
}

export function optionalString(
  body: Record<string, unknown>,
  field: string,
  options: { maxWords?: number; maxChars?: number; allowEmpty?: boolean } = {},
) {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new RequestValidationError(`${field} must be a string`);
  }
  const trimmed = value.trim();
  if (!options.allowEmpty && trimmed.length === 0) return '';
  if (options.maxChars !== undefined && trimmed.length > options.maxChars) {
    throw new RequestValidationError(`${field} must be ${options.maxChars} characters or fewer`);
  }
  if (options.maxWords !== undefined && countWords(trimmed) > options.maxWords) {
    throw new RequestValidationError(`${field} must be ${options.maxWords} words or fewer`);
  }
  return trimmed;
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
  options: { maxWords?: number; maxChars?: number } = {},
) {
  const value = optionalString(body, field, { ...options, allowEmpty: false });
  if (!value) {
    throw new RequestValidationError(`${field} is required`);
  }
  return value;
}

export function optionalNumber(
  body: Record<string, unknown>,
  field: string,
  options: { min?: number; max?: number } = {},
) {
  const value = body[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RequestValidationError(`${field} must be a valid number`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new RequestValidationError(`${field} must be at least ${options.min}`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new RequestValidationError(`${field} must be at most ${options.max}`);
  }
  return value;
}

export function optionalStringArray(
  body: Record<string, unknown>,
  field: string,
  allowedValues: readonly string[],
) {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new RequestValidationError(`${field} must be an array of strings`);
  }

  const allowed = new Set(allowedValues);
  const invalid = value.find(item => !allowed.has(item));
  if (invalid) {
    throw new RequestValidationError(`${field} contains an invalid value`);
  }

  return value;
}

export function optionalKnownString(
  body: Record<string, unknown>,
  field: string,
  allowedValues: readonly string[],
  options: { maxChars?: number } = {},
) {
  const value = optionalString(body, field, { maxChars: options.maxChars ?? 100, allowEmpty: true });
  if (value === undefined || value === '') return value;

  const allowed = new Set(allowedValues);
  if (!allowed.has(value)) {
    throw new RequestValidationError(`${field} contains an invalid value`);
  }

  return value;
}

function countWords(value: string) {
  if (!value.trim()) return 0;
  return value.trim().split(/\s+/).length;
}
