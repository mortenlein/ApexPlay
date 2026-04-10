import { RouteNotFoundState } from "@/components/RouteStates";

export default function NotFound() {
  return (
    <RouteNotFoundState
      title="Admin Route Not Found"
      description="The admin destination you requested does not exist."
      primaryHref="/admin"
      primaryLabel="Admin Home"
      secondaryHref="/login?callbackUrl=/admin"
      secondaryLabel="Admin Login"
    />
  );
}
