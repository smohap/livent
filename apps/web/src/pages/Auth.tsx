import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Ambient } from '@/components/Ambient';
import { Button, ErrorNote, Field } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(mode === 'login' ? 'sarah@evyent.com' : '');
  const [password, setPassword] = useState(mode === 'login' ? 'evyent2026' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === 'login';

  async function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await signup(name, email, password);
      const target = (location.state as { from?: string } | null)?.from ?? '/app';
      navigate(target, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Ambient />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
        <div className="liquid-glass-strong w-full max-w-md rounded-[1.6rem] p-9">
          <Link to="/" className="mb-8 flex items-center gap-2.5">
            <img src="/logo.svg" alt="" width={30} height={30} />
            <span className="text-xl font-semibold tracking-tighter">Evyent</span>
          </Link>

          <h1 className="text-3xl tracking-tight">
            {isLogin ? 'Welcome back' : 'Create your '}
            {isLogin ? null : <em>account</em>}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {isLogin
              ? 'Sign in to your event workspace.'
              : 'One workspace for every event you run.'}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {isLogin ? null : (
              <Field
                label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              hint={isLogin ? undefined : 'At least 8 characters'}
            />

            {error ? <ErrorNote message={error} /> : null}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Just a moment...' : isLogin ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-white/45">
            {isLogin ? 'No account yet? ' : 'Already have an account? '}
            <Link to={isLogin ? '/signup' : '/login'} className="text-white/80 underline-offset-4 hover:underline">
              {isLogin ? 'Create one' : 'Sign in'}
            </Link>
          </p>

          {isLogin ? (
            <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-white/35">
              Demo workspace pre-filled: sarah@evyent.com / evyent2026
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
