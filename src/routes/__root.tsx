import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { getAppMetadata } from "@/lib/app-metadata.functions";
import { getSiteTexts, getIsAdmin } from "@/lib/site-texts.functions";
import { SiteTextsProvider } from "@/lib/site-texts-context";
import { useAuth } from "@/hooks/use-auth";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    const [metaR, textsR] = await Promise.allSettled([getAppMetadata(), getSiteTexts()]);
    return {
      meta: metaR.status === "fulfilled" ? metaR.value : null,
      siteTexts: textsR.status === "fulfilled" ? textsR.value : {},
      isAdmin: false,
    };
  },
  head: ({ loaderData }) => {
    const m = loaderData?.meta;
    const title = m?.title || "סוכן ניתוח מערכות — תרשימים מתוך טקסט";
    const description =
      m?.description ||
      "סוכן AI לאנליסטים: הופך דרישות וטקסט חופשי לתרשימי זרימה, swim-lanes, ER ורצף — עם עריכה ויזואלית וקוד Mermaid.";
    const ogTitle = m?.og_title || title;
    const ogDescription = m?.og_description || description;
    const siteName = m?.og_site_name || "סוכן ניתוח מערכות";
    const ogType = m?.og_type || "website";

    const meta: Array<Record<string, string>> = [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title },
      { name: "description", content: description },
      { property: "og:title", content: ogTitle },
      { property: "og:description", content: ogDescription },
      { property: "og:site_name", content: siteName },
      { property: "og:type", content: ogType },
    ];
    if (m?.og_image_url) {
      meta.push({ property: "og:image", content: m.og_image_url });
      meta.push({ name: "twitter:image", content: m.og_image_url });
      meta.push({ name: "twitter:card", content: "summary_large_image" });
    }

    const links: Array<Record<string, string>> = [{ rel: "stylesheet", href: appCss }];
    if (m?.favicon_url) {
      links.push({ rel: "icon", href: m.favicon_url });
    }
    if (m?.apple_touch_icon_url) {
      links.push({ rel: "apple-touch-icon", href: m.apple_touch_icon_url });
    }

    return { meta, links };
  },

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function AuthBridge() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Only invalidate on real auth transitions — ignore TOKEN_REFRESHED,
      // INITIAL_SESSION, and USER_UPDATED which fire repeatedly.
      // router.invalidate() re-runs loaders which already prime the query
      // cache via ensureQueryData, so queryClient.invalidateQueries() is
      // redundant and was causing double-fetches across the app.
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        queryClient.clear();
        router.invalidate();
        import("@/lib/login-log.functions")
          .then(({ recordLoginEvent }) =>
            recordLoginEvent({
              data: {
                event: event === "SIGNED_IN" ? "signed_in" : "signed_out",
                provider:
                  (session?.user?.app_metadata?.provider as string | undefined) ?? null,
                email: session?.user?.email ?? null,
              },
            }),
          )
          .catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);
  return null;
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const loaderData = Route.useLoaderData();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBridge />
      <SiteTextsBridge initialTexts={loaderData?.siteTexts ?? {}}>
        <Outlet />
      </SiteTextsBridge>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

// Isolates useAuth + is-admin query so auth changes don't re-render
// the Outlet's parent unnecessarily. children is a stable prop.
function SiteTextsBridge({
  initialTexts,
  children,
}: {
  initialTexts: Record<string, string>;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const isAdminFn = useServerFn(getIsAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["is-admin", user?.id ?? null],
    queryFn: () => isAdminFn(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  return (
    <SiteTextsProvider
      initialTexts={initialTexts}
      isAdmin={adminData?.isAdmin ?? false}
    >
      {children}
    </SiteTextsProvider>
  );
}

