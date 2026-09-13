"use client";

import { useTranslations } from "next-intl";
import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  const t = useTranslations("directory");
  return <RouteErrorState title={t("errorTitle")} description={t("errorBody")} />;
}
