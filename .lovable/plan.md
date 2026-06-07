## Changes in `src/routes/_authenticated/dashboard.tsx`

1. **Center the section headings**
   - Change `<h2 className="mb-2 text-sm font-semibold text-muted-foreground">` for both **UML** and **PR-Docs** to include `text-center`.

2. **Add a "עוד" (More) tile to the diagrams (UML) group**
   - Render `<MoreTile />` at the end of the diagram grid, identical to the one already in PR-Docs.
   - Both MoreTiles open the same drawer (`setMoreOpen(true)`) — no change needed to the drawer or extras logic.
   - Filter the drawer contents by which group was clicked: track `moreOpen` as `null | "diagram" | "document"` and filter `extrasTiles` by `OUTPUT_TYPES[k].category` so the UML "עוד" shows only diagram extras (`diagram_state`, `diagram_deployment`) and the PR-Docs "עוד" shows only document extras (`user_guide` + anything moved-to-extras of that category).
   - Drawer title/description adjusted per group ("תרשימים נוספים" vs "מסמכים נוספים").

No backend, no DB, no other component changes.