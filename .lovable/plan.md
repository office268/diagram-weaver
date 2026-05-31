# Plan: Implement remaining items (10, 11, 15, 18, 20, 21, 22, 23, 24, 25)

## 10 — Auto-save robustness (`editor.$id.tsx`)
- Add `beforeunload` listener that warns if there are pending unsaved changes (dirty state / pending debounce).
- Display "נשמר לאחרונה לפני X" using `formatDistanceToNow` (date-fns, already in deps) next to the auto-save indicator, refreshed every 30s.

## 11 — Logo consistency
- Replace `GitBranch` icon usage with `FileText` (or a single chosen icon) wherever the brand mark appears so landing header, auth pages, and app header all match. Audit: `src/routes/index.tsx`, `src/routes/login.tsx`, `src/routes/_authenticated.tsx`.

## 15 — Keyboard shortcuts (`editor.$id.tsx`)
- `Cmd/Ctrl+S` → trigger manual save (prevent default browser save).
- `Cmd/Ctrl+K` → open a section quick-search `CommandDialog` (cmdk via existing `command.tsx`) listing sections; Enter scrolls to + focuses the section.
- `Esc` → close any open AI Popover / Preview Dialog (already partly handled by Radix; ensure popover state closes).

## 18 — Score tooltip
- Wrap the "X/10" badge (review panel / editor header) in a `Tooltip` explaining the rubric criteria (completeness, clarity, consistency, feasibility, testability). Pull the criteria list from a small constant.

## 20 — Landing meta consistency
- Align `head().meta` `title` in `src/routes/index.tsx` with the H1 from site-texts default ("מסמכי אפיון שכותבים את עצמם.") and ensure description matches subtitle. Same for `og:title` / `og:description`.

## 21 — Dark mode toggle
- Add CSS variables for `.dark` in `src/styles.css` (mirror existing tokens with dark oklch values).
- Create `src/hooks/use-theme.ts` — persists to `localStorage`, toggles `documentElement.classList`.
- Add a `ThemeToggle` button (Sun/Moon icons) in the authenticated header (`_authenticated.tsx`) and landing header.

## 22 — User avatar in header (`_authenticated.tsx`)
- Replace the email text with an `Avatar` (initials fallback from email; `avatar_url` from `profiles` if present).
- Wrap in a `DropdownMenu`: shows email, link to settings, logout. Fetch profile via existing query or add a lightweight `getMyProfile` server fn (only if not already available).

## 23 — Footer on authenticated pages (`_authenticated.tsx`)
- Add a small footer below `<Outlet />` with links: Privacy / Terms / About. Create placeholder routes `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/about.tsx`, each with proper `head()` and minimal Hebrew content.

## 24 — Doc-type mini-badges in project cards (`projects.$projectId.tsx` + `projects.index.tsx`)
- For each spec document card, show a colored `Badge` with the localized `doc_type` label (lookup from `src/lib/doc-types.ts`).
- Assign each doc-type a token color (semantic CSS var → tailwind class).

## 25 — Admin-only settings sections (`settings.tsx`)
- Use `isAdmin` from `SiteTextsProvider` context (already loaded in root).
- Hide `AppMetadataCard` and `DocTypeSectionsCard` sections when `!isAdmin`.
- (No DB change needed — `app_metadata` write policies are already authenticated-only; if user wants hard server gating, add a follow-up migration to require `has_role(auth.uid(), 'admin')`. Out of scope unless user asks.)

## Technical notes
- All frontend-only; no migrations required.
- Files created: `src/hooks/use-theme.ts`, `src/components/theme-toggle.tsx`, `src/components/user-menu.tsx`, `src/routes/privacy.tsx`, `src/routes/terms.tsx`, `src/routes/about.tsx`.
- Files edited: `src/styles.css`, `src/routes/__root.tsx` (apply theme class on mount), `src/routes/_authenticated.tsx`, `src/routes/_authenticated/editor.$id.tsx`, `src/routes/_authenticated/settings.tsx`, `src/routes/_authenticated/projects.$projectId.tsx`, `src/routes/_authenticated/projects.index.tsx`, `src/routes/index.tsx`, `src/routes/login.tsx`.
- Verification: visual check on mobile (384px) and desktop; Cmd+S / Cmd+K shortcuts; dark mode toggle persists across reload; admin gating with a non-admin account.
