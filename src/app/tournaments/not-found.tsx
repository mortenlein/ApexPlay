import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Directory Not Found"
      description="This tournaments page is not available."
      primaryHref="/"
      primaryLabel="Go Home"
      secondaryHref="/dashboard"
      secondaryLabel="Open Dashboard"
    />
  );
}
