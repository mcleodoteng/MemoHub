import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, EyeOff, AlertCircle, ShieldCheck } from "lucide-react";

const Login = () => {
  const { login, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [challengeToken, setChallengeToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(30);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleResendCode = async () => {
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await apiRequest<{
        success: boolean;
        data: { challengeToken: string };
      }>("/auth/resend-2fa", {
        method: "POST",
        body: JSON.stringify({ challengeToken }),
      });
      setChallengeToken(res.data.challengeToken);
      setResendMessage({
        text: "A new code has been sent to your email.",
        ok: true,
      });
      startCooldown();
    } catch (err) {
      setResendMessage({
        text: err instanceof Error ? err.message : "Failed to resend code.",
        ok: false,
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login(email, password, rememberMe);
    setLoading(false);

    if (result.success && result.requiresTwoFactor) {
      setChallengeToken(result.challengeToken!);
      setTwoFactorPending(true);
    } else if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error || "Login failed");
    }
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await verifyTwoFactor(
      challengeToken,
      twoFactorCode,
      rememberMe,
    );
    setLoading(false);

    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setError(result.error || "Invalid verification code");
      setTwoFactorCode("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <img
            src="/logo.png"
            alt="MemoHub Logo"
            className="h-20 w-20 mx-auto"
          />
          <h1 className="font-display text-3xl font-bold text-foreground">
            MemoHub
          </h1>
          <p className="text-sm text-muted-foreground">
            Enterprise Memo Management Platform
          </p>
        </div>

        {twoFactorPending ? (
          /* 2FA Challenge Form */
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-display">
                  Two-Factor Verification
                </CardTitle>
              </div>
              <CardDescription>
                A 6-digit code has been sent to your email. Enter it below to
                sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="123456"
                    value={twoFactorCode}
                    onChange={(e) =>
                      setTwoFactorCode(e.target.value.replace(/\D/g, ""))
                    }
                    required
                    autoComplete="one-time-code"
                    autoFocus
                    className="text-center text-xl tracking-widest"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || twoFactorCode.length !== 6}
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>

                {resendMessage && (
                  <p
                    className={`text-sm text-center ${resendMessage.ok ? "text-muted-foreground" : "text-destructive"}`}
                  >
                    {resendMessage.text}
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-sm"
                  onClick={handleResendCode}
                  disabled={resendLoading || resendCooldown > 0}
                >
                  {resendLoading
                    ? "Sending..."
                    : resendCooldown > 0
                      ? `Resend code (${resendCooldown}s)`
                      : "Resend code"}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => {
                    setTwoFactorPending(false);
                    setChallengeToken("");
                    setTwoFactorCode("");
                    setError("");
                    setResendMessage(null);
                    setResendCooldown(0);
                    if (cooldownRef.current) clearInterval(cooldownRef.current);
                  }}
                >
                  Back to Login
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Standard Login Form */
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-display">Sign In</CardTitle>
              <CardDescription>
                Enter your credentials to access the platform
              </CardDescription>
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) =>
                        setRememberMe(checked === true)
                      }
                    />
                    <Label
                      htmlFor="remember"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Remember me
                    </Label>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>

                <p className="text-sm text-center text-muted-foreground">
                  Contact your system administrator to create an account.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display">Memo Hub</CardTitle>
            <CardDescription className="text-xs">
              Create, Share, and Collaborate on Memos Seamlessly
            </CardDescription>
            <CardDescription className="text-xs">
              Powered by{" "}
              <a href="https://infotechsystemsonline.com/">
                Infotech Dot Net Systems Limited
              </a>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Login;
