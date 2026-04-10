"use client";

import { RouteErrorState } from "@/components/RouteStates";

export default function Error() {
  return (
    <RouteErrorState
      title="Marshal Board Error"
      description="The marshal dashboard failed to load."
    />
  );
}
