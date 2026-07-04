import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { rateLimitRequest } from '@/lib/security/rate-limit';
import { getSupabasePublishableKey, getSupabaseUrl } from './env';

const PUBLIC_PATHS = new Set(['/', '/login', '/auth/callback']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function isAssetPath(pathname: string) {
  return pathname.startsWith('/_next/')
    || pathname.startsWith('/fonts/')
    || pathname === '/favicon.ico'
    || /\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/i.test(pathname);
}

function sameOrigin(request: NextRequest) {
  const expectedOrigin = request.nextUrl.origin;
  const source = request.headers.get('origin') || request.headers.get('referer') || '';

  if (!source) return false;

  try {
    return new URL(source).origin === expectedOrigin;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') && !SAFE_METHODS.has(request.method) && !sameOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }

  const rateLimitResponse = rateLimitRequest(request);
  if (rateLimitResponse) return rateLimitResponse;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && !isPublicPath(pathname) && !isAssetPath(pathname) && !pathname.startsWith('/api/')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.search = '';
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (signedIn && (pathname === '/' || pathname === '/login')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
