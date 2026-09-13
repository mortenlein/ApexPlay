import { useTranslations } from "next-intl";
import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  const t = useTranslations("directory");
  const tc = useTranslations("common");
  return (
    <RouteNotFoundState
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
      primaryHref="/"
      primaryLabel={tc("goHome")}
      secondaryHref="/dashboard"
      secondaryLabel={t("openDashboard")}
    />
  );
}
