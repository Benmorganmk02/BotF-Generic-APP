import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { setGuestMode } from '../utils/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sword, LogIn, UserX } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const { user, isLoading, signUpWithPassword, signInWithPassword, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  useEffect(() => {
    // Signed-in user always wins — clear any stale guest flag
    if (user) setGuestMode(false);
    if (!isLoading && user) navigate('/', { replace: true });
    // Note: deliberately NOT redirecting on stale guest-mode flags here —
    // visiting /login is explicit intent to sign in for real.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLoading]);

  const continueAsGuest = () => {
    setGuestMode(true);
    // Full reload (not react-router navigate): AuthGuard reads isGuestMode()
    // only on render and isn't already re-rendering here since the route
    // ('/') isn't changing, so a plain navigate leaves the login screen
    // stuck on-screen until something else triggers a re-render. When
    // we're already at '/' (the common case — AuthGuard's inline fallback),
    // assigning location.href to the same URL isn't reliably a reload
    // across browsers, so force it explicitly.
    if (window.location.pathname === '/') {
      window.location.reload();
    } else {
      window.location.href = '/';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);

    if (mode === 'signup') {
      const { error, needsEmailConfirmation } = await signUpWithPassword(email, password);
      setSubmitting(false);
      if (error) {
        toast.error(error);
      } else if (needsEmailConfirmation) {
        setConfirmationSent(true);
        toast.success('Check your email to confirm your account');
      } else {
        toast.success('Account created!');
      }
    } else {
      const { error } = await signInWithPassword(email, password);
      setSubmitting(false);
      if (error) toast.error(error);
    }
  };

  const handleGoogle = async () => {
    const { error } = await signInWithGoogle();
    if (error) toast.error(error);
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <div className="flex justify-center">
            <div className="h-20 w-20 rounded-2xl bg-primary/20 border border-primary/40 flex items-center justify-center">
              <Sword className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground">RPG Character Manager</h1>
          <p className="text-muted-foreground text-sm">Manage your homebrew tabletop RPG characters</p>
        </div>

        <div className="space-y-3">
          {confirmationSent ? (
            <p className="text-sm text-muted-foreground">
              Confirmation email sent to {email}. Click the link there, then come back and sign in.
            </p>
          ) : (
            <>
              <div className="flex rounded-md border border-input p-1 text-sm">
                <button
                  type="button"
                  className={`flex-1 rounded py-1.5 transition-colors ${mode === 'signin' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setMode('signin')}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded py-1.5 transition-colors ${mode === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setMode('signup')}
                >
                  Create Account
                </button>
              </div>

              <form className="space-y-3 text-left" onSubmit={handleSubmit}>
                <div className="space-y-1">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={submitting || !email || !password}>
                  {submitting ? (mode === 'signup' ? 'Creating account…' : 'Signing in…') : mode === 'signup' ? 'Create Account' : 'Sign In'}
                </Button>
              </form>
            </>
          )}

          <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div><div className="relative flex justify-center"><span className="bg-background px-2 text-xs text-muted-foreground">or</span></div></div>
          <Button variant="outline" className="w-full" size="lg" onClick={handleGoogle}>
            <LogIn className="h-4 w-4 mr-2" />
            Sign In with Google
          </Button>
          <Button variant="outline" className="w-full" size="lg" onClick={continueAsGuest}>
            <UserX className="h-4 w-4 mr-2" />
            Continue as Guest
          </Button>
          <p className="text-xs text-muted-foreground">Guest characters are saved locally in your browser only</p>
        </div>
      </div>
    </div>
  );
}
