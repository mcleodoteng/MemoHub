import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Eye, EyeOff, AlertCircle } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const result = login(email, password, rememberMe);
      setLoading(false);
      if (result.success) {
        navigate('/', { replace: true });
      } else {
        setError(result.error || 'Login failed');
      }
    }, 600);
  };

  const roleExamples = [
    { role: 'Super Admin', email: 'alex@memohub.com', color: 'bg-destructive/10 text-destructive' },
    { role: 'Admin', email: 'sarah@memohub.com', color: 'bg-warning/10 text-warning' },
    { role: 'Manager', email: 'priya@memohub.com', color: 'bg-info/10 text-info' },
    { role: 'Group Leader', email: 'marcus@memohub.com', color: 'bg-accent/10 text-accent' },
    { role: 'Member', email: 'james@memohub.com', color: 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mx-auto">
            <FileText className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">MemoHub</h1>
          <p className="text-sm text-muted-foreground">Enterprise Memo Management Platform</p>
        </div>

        {/* Login Form */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-display">Sign In</CardTitle>
            <CardDescription>Enter your credentials to access the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@memohub.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Demo Accounts</CardTitle>
            <CardDescription className="text-xs">Password for all: <code className="bg-muted px-1 py-0.5 rounded text-foreground">password</code></CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {roleExamples.map(r => (
              <button
                key={r.email}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-secondary/60 transition-colors text-left"
                onClick={() => { setEmail(r.email); setPassword('password'); setError(''); }}
              >
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.color}`}>{r.role}</span>
                <span className="text-xs text-muted-foreground">{r.email}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
