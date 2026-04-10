import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Tournament Not Found"
      description="This tournament does not exist or is no longer available."
      primaryHref="/tournaments"
      primaryLabel="Back to Tournaments"
      secondaryHref="/dashboard"
      secondaryLabel="Open Dashboard"
    />
  );
}
