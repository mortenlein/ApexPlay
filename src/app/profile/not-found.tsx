import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Profile Not Found"
      description="This profile route is unavailable."
      primaryHref="/dashboard"
      primaryLabel="Back to Dashboard"
      secondaryHref="/tournaments"
      secondaryLabel="Browse Tournaments"
    />
  );
}
