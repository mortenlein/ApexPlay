import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Login Route Not Found"
      description="This login route is not available."
      primaryHref="/login"
      primaryLabel="Open Login"
      secondaryHref="/"
      secondaryLabel="Go Home"
    />
  );
}
