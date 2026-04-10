"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return (
    <RouteErrorState
      title="Tournaments Unavailable"
      description="We could not load the tournament directory right now."
    />
  );
}
