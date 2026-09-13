"use client";

import { useTranslations } from "next-intl";
import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  const t = useTranslations("landing");
  return <RouteErrorState title={t("login.errorTitle")} description={t("login.errorBody")} />;
}
