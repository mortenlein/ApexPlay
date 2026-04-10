'use client';

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Lock, ShieldAlert, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from 'next/link';

function LoginContent() {
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/admin";
  const callbackUrl = rawCallbackUrl.startsWith("/") ? rawCallbackUrl : "/admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error || "Invalid admin password.");
        return;
      }

      window.location.assign(callbackUrl);
      return;
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const heading = callbackUrl.startsWith("/marshal")
    ? "Staff Access"
    : "Admin Access";

  return (
    <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--mds-action)]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--mds-action)]/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 space-y-10">
        <div className="text-center space-y-5">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-mds-comfortable bg-[var(--mds-action)] text-white shadow-[0_0_20px_var(--mds-action)] animate-in zoom-in duration-500">
            <Lock size={28} strokeWidth={2.5} />
          </div>
          <div className="space-y-3">
            <h1 className="font-brand text-4xl md:text-5xl font-black tracking-tighter text-[var(--mds-text-primary)] uppercase leading-[0.9] animate-in slide-in-from-top-8 duration-700">
              {heading}
            </h1>
            <p className="text-[var(--mds-text-muted)] font-medium leading-relaxed max-w-sm mx-auto">
              Use the admin password to open tournaments, brackets, match controls, and floor tools.
            </p>
          </div>
        </div>

        <form 
          onSubmit={handleSubmit} 
          className="mds-card p-10 space-y-8 bg-[var(--mds-input)]/20 backdrop-blur-xl border-[var(--mds-border)] shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="mds-uppercase-label text-[10px] tracking-[0.15em] opacity-50">Admin Password</label>
              <div className="h-1 w-8 bg-[var(--mds-border)]" />
            </div>
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoFocus
                data-testid="admin-password"
                className="w-full bg-[var(--mds-page)] border-2 border-[var(--mds-border)] rounded-mds-comfortable h-14 px-5 font-mono text-sm tracking-wider text-[var(--mds-text-primary)] placeholder:opacity-20 focus:outline-none focus:border-[var(--mds-action)] focus:ring-4 focus:ring-[var(--mds-action)]/5 transition-all"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--mds-text-muted)] opacity-20 group-focus-within:opacity-100 transition-opacity">
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 bg-[var(--mds-red)]/10 border border-[var(--mds-red)]/20 rounded-mds-comfortable animate-in shake duration-300">
              <ShieldAlert size={18} className="text-[var(--mds-red)]" />
              <p className="text-xs font-bold text-[var(--mds-red)] uppercase tracking-tight">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !password}
            data-testid="admin-login-submit"
            className="mds-btn-primary w-full h-14 font-black uppercase tracking-[0.2em] text-xs gap-3 shadow-[0_4px_15px_rgba(var(--mds-action-rgb),0.3)] hover:shadow-[0_8px_25px_rgba(var(--mds-action-rgb),0.4)] disabled:opacity-50 disabled:shadow-none transition-all group"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <>
                <ShieldCheck size={18} />
                Open Workspace
              </>
            )}
          </button>
        </form>

        <div className="flex items-center justify-between pt-2 animate-in fade-in duration-1000 delay-500">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-full border border-[var(--mds-border)] flex items-center justify-center group-hover:bg-[var(--mds-input)] transition-all">
              <ArrowLeft size={16} className="text-[var(--mds-text-muted)] group-hover:text-[var(--mds-text-primary)] group-hover:-translate-x-0.5 transition-all" />
            </div>
            <span className="mds-uppercase-label text-[9px] opacity-40 font-bold group-hover:opacity-100 transition-all uppercase tracking-widest">Back to home</span>
          </Link>
          <p className="mds-uppercase-label text-[8px] opacity-40 font-bold">Secure admin sign-in</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
        <div className="min-h-screen bg-[var(--mds-page)] flex items-center justify-center">
            <Loader2 className="animate-spin text-[var(--mds-action)]" size={40} />
        </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
