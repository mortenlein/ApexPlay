"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return (
    <RouteErrorState
      title="Admin Workspace Error"
      description="The admin dashboard failed to load."
    />
  );
}
