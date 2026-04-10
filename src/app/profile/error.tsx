"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return <RouteErrorState title="Profile Error" description="Your profile could not be loaded." />;
}
