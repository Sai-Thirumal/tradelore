const SECRET_PATTERNS = [
  /(request_token=)[^&\s]+/gi,
  /(checksum=)[^&\s]+/gi,
  /(api_secret=)[^&\s]+/gi,
  /(access_token=)[^&\s]+/gi,
  /(Authorization:\s*token\s+)[^\s]+/gi,
  /(token\s+)[A-Za-z0-9_-]+:[A-Za-z0-9_-]+/gi,
];

export function redactSensitiveText(value: string) {
  return SECRET_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '$1[redacted]'),
    value,
  );
}

export function safeBrokerErrorMessage(error: unknown, fallback = 'Zerodha request failed.') {
  if (!(error instanceof Error)) return fallback;
  return redactSensitiveText(error.message || fallback);
}
