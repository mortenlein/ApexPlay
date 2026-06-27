'use client';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import Link from 'next/link';
import { MockPersonaButtons } from "@/components/MockPersonaButtons";

function LoginContent() {
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/admin";
  const callbackUrl = rawCallbackUrl.startsWith("/") ? rawCallbackUrl : "/admin";

  const heading = callbackUrl.startsWith("/marshal") ? "Staff Access" : "Sign In";

  return (
    <div className="min-h-screen bg-[var(--mds-page)] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--mds-action)]/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[var(--mds-action)]/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 space-y-10">
        <div className="text-center space-y-5">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-mds-comfortable bg-[var(--mds-action)] text-white shadow-[0_0_20px_var(--mds-action)]">
            <ShieldCheck size={28} strokeWidth={2.5} />
          </div>
          <div className="space-y-3">
            <h1 className="font-brand text-4xl md:text-5xl font-black tracking-tighter text-[var(--mds-text-primary)] uppercase leading-[0.9]">
              {heading}
            </h1>
            <p className="text-[var(--mds-text-muted)] font-medium leading-relaxed max-w-sm mx-auto">
              Sign in with Steam to register for tournaments. Organizer tools unlock
              automatically for accounts on the admin allowlist.
            </p>
          </div>
        </div>

        <div className="mds-card p-10 space-y-6 bg-[var(--mds-input)]/20 backdrop-blur-xl border-[var(--mds-border)] shadow-2xl flex flex-col items-center">
          <button
            type="button"
            onClick={() => signIn("steam", { callbackUrl })}
            data-testid="steam-login"
            className="mds-btn-primary w-full h-14 font-black uppercase tracking-[0.2em] text-xs gap-3"
          >
            <ShieldCheck size={18} />
            Sign in through Steam
          </button>

          <MockPersonaButtons callbackUrl={callbackUrl} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-full border border-[var(--mds-border)] flex items-center justify-center group-hover:bg-[var(--mds-input)] transition-all">
              <ArrowLeft size={16} className="text-[var(--mds-text-muted)] group-hover:text-[var(--mds-text-primary)] group-hover:-translate-x-0.5 transition-all" />
            </div>
            <span className="mds-uppercase-label text-[9px] opacity-40 font-bold group-hover:opacity-100 transition-all uppercase tracking-widest">Back to home</span>
          </Link>
          <p className="mds-uppercase-label text-[8px] opacity-40 font-bold">Secure Steam sign-in</p>
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
