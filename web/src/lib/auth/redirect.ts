const DEFAULT_REDIRECT_PATH = '/dashboard';
const INTERNAL_ORIGIN = 'https://tradelore.local';

export function getInternalRedirectPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return DEFAULT_REDIRECT_PATH;
  }

  try {
    const url = new URL(path, INTERNAL_ORIGIN);

    if (url.origin !== INTERNAL_ORIGIN) {
      return DEFAULT_REDIRECT_PATH;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT_PATH;
  }
}
