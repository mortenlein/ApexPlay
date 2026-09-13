import { useTranslations } from "next-intl";
import { RouteLoadingState } from "@/components/RouteStates";

// Sync on purpose: a Suspense fallback must not suspend itself.
export default function Loading() {
  const t = useTranslations("marshal");
  return <RouteLoadingState label={t("loadingLabel")} />;
}
