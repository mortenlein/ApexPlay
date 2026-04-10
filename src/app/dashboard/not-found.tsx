import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Dashboard Not Found"
      description="This dashboard route is unavailable."
      primaryHref="/tournaments"
      primaryLabel="Open Tournaments"
      secondaryHref="/"
      secondaryLabel="Go Home"
    />
  );
}
