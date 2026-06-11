// ============================================================
// src/routes/_authenticated/projects.index.tsx
// מסך מאומת (Authenticated route) — projects.index.tsx
// דורש משתמש מחובר; יושב תחת layout _authenticated
// ============================================================
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
