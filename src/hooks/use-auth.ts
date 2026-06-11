// ============================================================
// src/hooks/use-auth.ts
// Hook — use-auth
// ============================================================
import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Single shared auth store — one onAuthStateChange listener for the whole app.
// Previously every useAuth() consumer created its own listener + state, causing
// N re-renders per auth event and breaking referential equality of `user`
// across hooks (which in turn broke memoized queryKeys / effect deps).

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let state: AuthState = { session: null, user: null, loading: true };
const listeners = new Set<() => void>();
let initialized = false;

function setState(next: AuthState) {
  // Preserve referential equality when nothing meaningful changed.
  if (
    next.session === state.session &&
    next.user === state.user &&
    next.loading === state.loading
  ) {
    return;
  }
  state = next;
  listeners.forEach((l) => l());
}

function init() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, s) => {
    setState({ session: s, user: s?.user ?? null, loading: false });
  });

  supabase.auth.getSession().then(({ data }) => {
    setState({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
    });
  });
}

function subscribe(cb: () => void) {
  init();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;
const getServerSnapshot = () => state;

export function useAuth() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
