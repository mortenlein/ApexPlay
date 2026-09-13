import { useTranslations } from "next-intl";
import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  const t = useTranslations("marshal");
  return (
    <RouteNotFoundState
      title={t("notFoundTitle")}
      description={t("notFoundBody")}
      primaryHref="/marshal/dashboard"
      primaryLabel={t("marshalHome")}
      secondaryHref="/admin"
      secondaryLabel={t("openAdmin")}
    />
  );
}
