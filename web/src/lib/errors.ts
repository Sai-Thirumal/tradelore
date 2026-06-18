export function getErrorMessage(error: unknown, fallback = 'Unexpected error') {
  return error instanceof Error ? error.message : fallback;
}

export function hasErrorCode(error: unknown, code: string) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code;
}

export function errorMessageIncludes(error: unknown, value: string) {
  return getErrorMessage(error, '').includes(value);
}
