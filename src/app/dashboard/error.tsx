"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return (
    <RouteErrorState
      title="Dashboard Error"
      description="Your player dashboard could not be loaded."
    />
  );
}
