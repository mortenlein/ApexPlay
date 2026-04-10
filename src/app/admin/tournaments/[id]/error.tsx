"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return (
    <RouteErrorState
      title="Tournament Workspace Error"
      description="The admin tournament workspace failed to load."
    />
  );
}
