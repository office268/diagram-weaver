// ============================================================
// src/routes/_authenticated/projects.$projectId.tsx
// מסך מאומת (Authenticated route) — projects.$projectId.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
