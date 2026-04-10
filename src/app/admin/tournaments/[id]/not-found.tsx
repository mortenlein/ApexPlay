import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Tournament Workspace Not Found"
      description="This admin tournament route does not exist."
      primaryHref="/admin"
      primaryLabel="Back to Admin"
      secondaryHref="/tournaments"
      secondaryLabel="Open Public Site"
    />
  );
}
