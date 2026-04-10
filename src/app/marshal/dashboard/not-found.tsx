import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Marshal Board Not Found"
      description="This marshal route is not available."
      primaryHref="/marshal/dashboard"
      primaryLabel="Marshal Home"
      secondaryHref="/admin"
      secondaryLabel="Open Admin"
    />
  );
}
