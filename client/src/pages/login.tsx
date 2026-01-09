import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Cpu, Mail, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const { requestMagicLink } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await requestMagicLink(email);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error || "Failed to send magic link");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen noise bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/">
          <Button variant="ghost" className="mb-8 -ml-4" data-testid="link-back-home">
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Home
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold">Sign in to AIHackr</h1>
        </div>

        {sent ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-6">
              We sent a sign-in link to <strong className="text-foreground">{email}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Click the link in your email to sign in. The link expires in 15 minutes.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => { setSent(false); setEmail(""); }}
              data-testid="button-try-different-email"
            >
              Try a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8">
            <p className="text-muted-foreground mb-6">
              Enter your email and we'll send you a magic link to sign in. No password needed.
            </p>

            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="pl-10 h-12"
                  data-testid="input-email"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500" data-testid="text-error">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isLoading || !email}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-send-magic-link"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send magic link"
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              By signing in, you agree to our{" "}
              <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
              {" "}and{" "}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
