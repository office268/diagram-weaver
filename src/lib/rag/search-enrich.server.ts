// ============================================================
// src/lib/search-enrich.server.ts
// מודול server-only — search-enrich.server.ts
// מורץ רק בצד השרת (TanStack Start)
// ============================================================
// Server-only helper to enrich list rows with author name and product/project path.
// Used by global search to display: name · type · date · path · author.

import type { SupabaseClient } from "@supabase/supabase-js";

export type EnrichInput = {
  user_id?: string | null;
  project_id?: string | null;
};

export type EnrichOutput = {
  author_name: string | null;
  project_name: string | null;
  product_name: string | null;
};

export async function buildSearchMaps(
  supabase: SupabaseClient,
  rows: EnrichInput[],
) {
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)),
  );
  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id).filter((v): v is string => !!v)),
  );

  const profilesMap = new Map<string, string>();
  if (userIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of data ?? []) {
      if ((p as { display_name: string | null }).display_name) {
        profilesMap.set(
          (p as { id: string }).id,
          (p as { display_name: string }).display_name,
        );
      }
    }
  }

  const projectsMap = new Map<string, { name: string; product_id: string | null }>();
  if (projectIds.length) {
    const { data } = await supabase
      .from("projects")
      .select("id, name, product_id")
      .in("id", projectIds);
    for (const p of data ?? []) {
      projectsMap.set((p as { id: string }).id, {
        name: (p as { name: string }).name,
        product_id: (p as { product_id: string | null }).product_id ?? null,
      });
    }
  }

  const productIds = Array.from(
    new Set(
      Array.from(projectsMap.values())
        .map((p) => p.product_id)
        .filter((v): v is string => !!v),
    ),
  );
  const productsMap = new Map<string, string>();
  if (productIds.length) {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    for (const p of data ?? []) {
      productsMap.set((p as { id: string }).id, (p as { name: string }).name);
    }
  }

  return { profilesMap, projectsMap, productsMap };
}

export function enrichRow(
  row: EnrichInput,
  maps: Awaited<ReturnType<typeof buildSearchMaps>>,
): EnrichOutput {
  const author_name = row.user_id ? maps.profilesMap.get(row.user_id) ?? null : null;
  const project = row.project_id ? maps.projectsMap.get(row.project_id) ?? null : null;
  const project_name = project?.name ?? null;
  const product_name = project?.product_id
    ? maps.productsMap.get(project.product_id) ?? null
    : null;
  return { author_name, project_name, product_name };
}
