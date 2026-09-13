import { useTranslations } from "next-intl";
import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  const t = useTranslations("landing");
  const tc = useTranslations("common");
  return (
    <RouteNotFoundState
      title={t("login.notFoundTitle")}
      description={t("login.notFoundBody")}
      primaryHref="/login"
      primaryLabel={t("login.openLogin")}
      secondaryHref="/"
      secondaryLabel={tc("goHome")}
    />
  );
}
