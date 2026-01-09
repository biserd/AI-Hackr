import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Cpu, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function AuthCallback() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { verifyToken } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");

    if (!token) {
      setError("Invalid link. Please request a new sign-in link.");
      setStatus("error");
      return;
    }

    verifyToken(token)
      .then((result) => {
        if (result.success) {
          setStatus("success");
          setTimeout(() => navigate("/dashboard"), 1500);
        } else {
          setError(result.error || "Verification failed");
          setStatus("error");
        }
      })
      .catch(() => {
        setError("An error occurred. Please try again.");
        setStatus("error");
      });
  }, [search, verifyToken, navigate]);

  return (
    <div className="min-h-screen noise bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <span className="font-display text-2xl font-bold">AIHackr</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-8">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-6" />
              <h2 className="font-display text-xl font-semibold mb-2">Verifying your link</h2>
              <p className="text-muted-foreground">Please wait...</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="font-display text-xl font-semibold mb-2">You're signed in!</h2>
              <p className="text-muted-foreground">Redirecting to your dashboard...</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-display text-xl font-semibold mb-2">Sign-in failed</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => navigate("/login")} data-testid="button-try-again">
                Try again
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
