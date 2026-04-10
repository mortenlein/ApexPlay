"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return <RouteErrorState title="Login Error" description="The login page failed to load." />;
}
