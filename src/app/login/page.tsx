'use client';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Loader2, ArrowLeft } from "lucide-react";
import Link from 'next/link';
import { MockPersonaButtons } from "@/components/MockPersonaButtons";

function LoginContent() {
  const t = useTranslations("landing");
  const searchParams = useSearchParams();
  const rawCallbackUrl = searchParams.get("callbackUrl") || "/admin";
  const callbackUrl = rawCallbackUrl.startsWith("/") ? rawCallbackUrl : "/admin";

  const staff = callbackUrl.startsWith("/marshal") || callbackUrl.startsWith("/admin");
  const heading = callbackUrl.startsWith("/marshal") ? t("login.titleStaff") : t("login.title");

  return (
    <div className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center overflow-hidden bg-page p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-[-10%] top-[-10%] h-[420px] w-[420px] rounded-full bg-brand/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[420px] w-[420px] rounded-full bg-brand/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] space-y-8">
        <div className="space-y-4 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg bg-brand text-brand-ink">
            <ShieldCheck size={26} aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="font-brand text-head font-bold tracking-tight text-fg">{heading}</h1>
            <p className="mx-auto max-w-sm text-body text-fg-muted">
              {staff ? t("login.blurbStaff") : t("login.blurb")}
            </p>
          </div>
        </div>

        <div className="mds-card flex flex-col items-center gap-5 p-6">
          <button
            type="button"
            onClick={() => signIn("steam", { callbackUrl })}
            data-testid="steam-login"
            className="mds-btn-primary mds-tap h-12 w-full gap-3 text-label font-bold uppercase tracking-[0.16em]"
          >
            <ShieldCheck size={17} aria-hidden />
            {t("login.steamButton")}
          </button>

          <MockPersonaButtons callbackUrl={callbackUrl} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="group mds-tap inline-flex items-center gap-2 rounded-sm text-meta font-semibold text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={15} aria-hidden className="transition-transform group-hover:-translate-x-0.5" />
            {t("login.backHome")}
          </Link>
          <p className="mds-uppercase-label text-fg-subtle">Steam OpenID</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center bg-page">
          <Loader2 className="animate-spin text-brand" size={32} aria-hidden />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
