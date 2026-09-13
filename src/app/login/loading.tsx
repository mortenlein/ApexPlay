import { useTranslations } from "next-intl";
import { RouteLoadingState } from "@/components/RouteStates";

// Sync on purpose: this renders as a Suspense fallback, so it must not suspend itself.
// `useTranslations` works in a non-async Server Component; `getTranslations` would not.
export default function Loading() {
  const t = useTranslations("landing");
  return <RouteLoadingState label={t("login.loadingLabel")} />;
}
