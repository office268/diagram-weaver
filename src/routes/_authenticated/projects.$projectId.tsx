import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
