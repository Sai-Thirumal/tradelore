'use client';

import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getInternalRedirectPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';

const PASSWORD_REQUIREMENTS_MESSAGE = 'Password must be at least 8 characters and include lowercase, uppercase, digit, and symbol characters.';
const STRONG_PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

async function signUpWithHashedPasswordStorage(email: string, password: string, emailRedirectTo: string) {
  const supabase = createClient();

  // Supabase Auth hashes and salts passwords before storage. Do not pre-hash
  // here: that would turn the client-side hash into the reusable password.
  return supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo,
    },
  });
}

function TradeLoreMark() {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="auth-logo-mark"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="10" y1="2" x2="10" y2="7" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 7H12.5L17 11.5V17H3V7Z" fill="#f97316" />
      <line x1="10" y1="17" x2="10" y2="22" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getInternalRedirectPath(searchParams.get('next'));
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const supabase = createClient();
      if (mode === 'signup') {
        if (!STRONG_PASSWORD_PATTERN.test(password)) {
          setError(PASSWORD_REQUIREMENTS_MESSAGE);
          return;
        }

        const { data, error: signUpError } = await signUpWithHashedPasswordStorage(
          email,
          password,
          `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        );
        if (signUpError) throw signUpError;
        setPassword('');
        if (data.session) {
          router.replace(next);
          router.refresh();
        } else {
          setMessage('Check your email to confirm your TradeLore account.');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        setPassword('');
        router.replace(next);
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page auth-page-compact">
      <section className="auth-panel">
        <div className="auth-brand compact">
          <TradeLoreMark />
          <span>TradeLore</span>
        </div>
        <div className="auth-copy compact">
          <h1>{mode === 'signup' ? 'Create your TradeLore account.' : 'Welcome back.'}</h1>
          <p>{mode === 'signup' ? 'Start importing trades, journaling decisions, and finding your edge.' : 'Log in to open your dashboard.'}</p>
        </div>
        <div className="auth-tabs">
          <button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Sign up</button>
          <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Log in</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={mode === 'signup' ? 'Minimum 8 chars, Aa, 0-9, symbol' : 'Enter your password'}
              minLength={mode === 'signup' ? 8 : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
            />
            {mode === 'signup' && <p className="auth-help">{PASSWORD_REQUIREMENTS_MESSAGE}</p>}
          </div>

          {error && <div className="auth-alert error">{error}</div>}
          {message && <div className="auth-alert success">{message}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>
      </section>
    </main>
  );
}
