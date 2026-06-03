import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "System Analyst Assist — כניסה" },
      { name: "description", content: "מסמכי אפיון שנכתבים בעצמם, בעזרת AI." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard" },
        });
        if (error) throw error;
        // Sign out immediately — access requires admin approval
        await supabase.auth.signOut();
        toast.success(
          "בקשת הרישום נשלחה. בשעות הקרובות תקבל אישור ופרטי כניסה במייל.",
          { duration: 8000 },
        );
        setMode("signin");
        setPassword("");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Check approval status
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (uid) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("approval_status")
            .eq("id", uid)
            .maybeSingle();
          const status = profile?.approval_status ?? "pending";
          if (status !== "approved") {
            await supabase.auth.signOut();
            if (status === "rejected") {
              toast.error("בקשת הרישום שלך נדחתה. צור קשר עם המנהל.");
            } else {
              toast.info("בקשת הרישום שלך ממתינה לאישור מנהל.", { duration: 8000 });
            }
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "האימות נכשל");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/dashboard",
      });
      if (result.error) throw result.error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ההתחברות עם Google נכשלה");
      setBusy(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      toast.success("נשלח קישור לאיפוס סיסמה לכתובת המייל");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שליחת המייל נכשלה");
    } finally {
      setForgotBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">

      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh]"
        style={{ background: "var(--gradient-hero)" }}
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <div className="relative h-32 w-32">
            {/* Outer aurora glow */}
            <div
              aria-hidden
              className="absolute inset-0 animate-pulse rounded-full blur-2xl"
              style={{
                background:
                  "conic-gradient(from 0deg, hsl(var(--primary)), #8b5cf6, #06b6d4, hsl(var(--primary)))",
                opacity: 0.55,
              }}
            />
            {/* Rotating ring */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full opacity-70"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0deg, hsl(var(--primary)) 90deg, #a78bfa 180deg, #22d3ee 270deg, transparent 360deg)",
                animation: "spin 6s linear infinite",
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
                mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
              }}
            />
            {/* Inner glossy orb */}
            <div
              className="absolute inset-2 flex items-center justify-center rounded-full shadow-2xl"
              style={{
                background:
                  "radial-gradient(circle at 30% 25%, #ffffff55, transparent 40%), linear-gradient(135deg, hsl(var(--primary)) 0%, #8b5cf6 60%, #6366f1 100%)",
                boxShadow:
                  "0 10px 40px -10px hsl(var(--primary) / 0.7), inset 0 -8px 20px rgba(0,0,0,0.25), inset 0 2px 6px rgba(255,255,255,0.4)",
              }}
            >
              <Sparkles
                className="h-11 w-11 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                strokeWidth={1.75}
              />
            </div>
          </div>
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            System Analyst Assist
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            ניתוח מערכות במהירות ה-AI ובאיכות של מומחים
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">כניסה</TabsTrigger>
              <TabsTrigger value="signup">הרשמה</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" />
            <TabsContent value="signup" />
          </Tabs>

          <form onSubmit={handleEmail} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">סיסמה</Label>
                {mode === "signin" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotOpen(true);
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    שכחתי סיסמה
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="mt-3 w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup" ? "יצירת חשבון" : "כניסה"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            או
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            <GoogleIcon className="mr-2 h-4 w-4" />
            המשך עם Google
          </Button>
        </div>

        <nav className="mt-6 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">פרטיות</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" className="hover:text-foreground">תנאי שימוש</Link>
          <span aria-hidden>·</span>
          <Link to="/about" className="hover:text-foreground">אודות</Link>
        </nav>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>איפוס סיסמה</DialogTitle>
            <DialogDescription>
              הזן את כתובת המייל שלך ונשלח אליך קישור לאיפוס הסיסמה.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">אימייל</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                disabled={forgotBusy}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setForgotOpen(false)} disabled={forgotBusy}>
                ביטול
              </Button>
              <Button type="submit" disabled={forgotBusy || !forgotEmail}>
                {forgotBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                שלח קישור
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
