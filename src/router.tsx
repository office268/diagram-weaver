import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Cache loader results across navigations — root loader (app metadata +
    // site texts) no longer re-runs on every Link click.
    defaultStaleTime: 5 * 60_000,
    defaultPreloadStaleTime: 5 * 60_000,
    defaultGcTime: 10 * 60_000,
    // Only preload when the user actually intends to navigate (click/touch),
    // not on every hover. Cuts preload storms on dense link lists.
    defaultPreload: false,
  });

  return router;
};
