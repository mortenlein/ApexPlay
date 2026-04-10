"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return (
    <RouteErrorState
      title="Tournament Page Failed"
      description="The tournament view could not be loaded."
    />
  );
}
