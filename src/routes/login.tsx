// ============================================================
// src/routes/login.tsx
// Route — login.tsx
// מסך/דף ב-TanStack Router (file-based routing)
// ============================================================
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
