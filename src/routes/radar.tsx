import { createFileRoute, redirect } from "@tanstack/react-router";
import { radarRouteRedirect } from "@/lib/radar-redirect";

export const Route = createFileRoute("/radar")({
  beforeLoad: () => {
    throw redirect({
      to: radarRouteRedirect.to,
      replace: radarRouteRedirect.replace,
      statusCode: radarRouteRedirect.statusCode,
    });
  },
});
