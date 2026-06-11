#!/usr/bin/env node
// ============================================================
// scripts/add-file-headers.mjs
// סקריפט חד-פעמי (idempotent) להוספת בלוק תיעוד עברי קצר בראש
// כל קבצי הקוד והתצורה בפרויקט. בטוח להרצה חוזרת.
// ============================================================
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// קבצים/נתיבים שלא נוגעים בהם בכלל
const SKIP_EXACT = new Set([
  "src/routeTree.gen.ts",
  "src/integrations/supabase/client.ts",
  "src/integrations/supabase/client.server.ts",
  "src/integrations/supabase/auth-middleware.ts",
  "src/integrations/supabase/auth-attacher.ts",
  "src/integrations/supabase/types.ts",
]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".lovable", "dist", "build", ".next",
  ".cache", ".turbo", "coverage",
]);

// סיומות + פונקציית עטיפה להערה
const COMMENT_STYLES = {
  ts: "slash", tsx: "slash", js: "slash", jsx: "slash", mjs: "slash", cjs: "slash",
  css: "css",
  sql: "sql",
  toml: "hash",
  md: "html",
};

function wrap(style, lines) {
  if (style === "slash") {
    return [
      "// ============================================================",
      ...lines.map((l) => `// ${l}`),
      "// ============================================================",
      "",
    ].join("\n");
  }
  if (style === "css") {
    return [
      "/* ============================================================",
      ...lines.map((l) => `   ${l}`),
      "   ============================================================ */",
      "",
    ].join("\n");
  }
  if (style === "sql") {
    return [
      "-- ============================================================",
      ...lines.map((l) => `-- ${l}`),
      "-- ============================================================",
      "",
    ].join("\n");
  }
  if (style === "hash") {
    return [
      "# ============================================================",
      ...lines.map((l) => `# ${l}`),
      "# ============================================================",
      "",
    ].join("\n");
  }
  if (style === "html") {
    return [
      "<!--",
      ...lines.map((l) => `  ${l}`),
      "-->",
      "",
    ].join("\n");
  }
  return "";
}

function describe(relPath) {
  const base = path.basename(relPath);
  const dir = path.dirname(relPath);

  // SQL migrations
  if (relPath.startsWith("supabase/migrations/")) {
    return ["Migration — " + base, "מיגרציית מסד נתונים (Lovable Cloud / Supabase)"];
  }
  if (relPath === "supabase/config.toml") {
    return ["תצורת פרויקט Supabase (Lovable Cloud)"];
  }

  // root config
  if (relPath === "vite.config.ts") return ["תצורת Vite + TanStack Start"];
  if (relPath === "eslint.config.js") return ["תצורת ESLint לפרויקט"];

  // README/md
  if (base.toLowerCase() === "readme.md") return ["מסמך README — תיעוד כללי לתיקייה/פרויקט"];
  if (relPath === ".lovable/plan.md") return ["מסמך תכנון פעיל (Lovable plan)"];
  if (base.endsWith(".md")) return ["מסמך תיעוד — " + base];

  // CSS
  if (base.endsWith(".css")) return ["קובץ סגנונות — " + base];

  // src/ patterns
  if (relPath.startsWith("src/routes/api/")) {
    return ["HTTP endpoint (server route) — " + base, "נקודת קצה ציבורית/פנימית עבור TanStack Start"];
  }
  if (relPath.startsWith("src/routes/_authenticated/")) {
    return ["מסך מאומת (Authenticated route) — " + base, "דורש משתמש מחובר; יושב תחת layout _authenticated"];
  }
  if (relPath.startsWith("src/routes/")) {
    if (base === "__root.tsx") return ["Route — שורש האפליקציה (shell, providers, layout)"];
    return ["Route — " + base, "מסך/דף ב-TanStack Router (file-based routing)"];
  }
  if (base.endsWith(".functions.ts") || base.endsWith(".functions.tsx")) {
    return ["Server function (createServerFn) — " + base, "נקודת RPC מהלקוח לשרת"];
  }
  if (base.endsWith(".server.ts") || base.endsWith(".server.tsx")) {
    return ["מודול server-only — " + base, "מורץ רק בצד השרת (TanStack Start)"];
  }

  // agents
  const agentMatch = relPath.match(/^src\/agents\/([^/]+)\/(.+)$/);
  if (agentMatch) {
    const [, agent, rest] = agentMatch;
    if (agent === "shared") return ["משאבים משותפים לכל הסוכנים — " + base];
    if (rest === "index.ts" || rest === "index.server.ts") return [`סוכן ${agent} — נקודת כניסה`];
    if (rest === "system.ts") return [`System prompt לסוכן ${agent}`];
    if (rest === "prompt.ts") return [`בונה Prompt עבור סוכן ${agent}`];
    if (rest === "schema.ts") return [`Schema/ולידציה לסוכן ${agent}`];
    return [`סוכן ${agent} — ${base}`];
  }

  // components/ui
  if (relPath.startsWith("src/components/ui/")) {
    const name = base.replace(/\.tsx?$/, "");
    return [`shadcn primitive — ${name}`, "רכיב UI בסיסי (shadcn/ui) — לא לערוך עיצוב גלובלי כאן"];
  }
  if (relPath.startsWith("src/components/")) {
    const name = base.replace(/\.tsx?$/, "");
    return [`רכיב UI — ${name}`];
  }
  if (relPath.startsWith("src/hooks/")) {
    return [`Hook — ${base.replace(/\.tsx?$/, "")}`];
  }
  if (relPath.startsWith("src/lib/")) {
    return [`ספריית עזר (lib) — ${base}`];
  }
  if (relPath.startsWith("src/integrations/")) {
    return [`אינטגרציה — ${relPath.replace("src/integrations/", "")}`];
  }
  if (relPath === "src/router.tsx") return ["הגדרת TanStack Router לאפליקציה"];
  if (relPath === "src/start.ts") return ["TanStack Start — middleware גלובלי"];

  if (relPath.startsWith("scripts/")) return [`Script — ${base}`];

  return [`${relPath}`];
}

const DIRECTIVE_RE = /^\s*(['"])use (client|server|strict)\1\s*;?\s*$/;
function isDirective(line) {
  return DIRECTIVE_RE.test(line) || line.startsWith("#!") || line.startsWith("// @ts-");
}

function hasExistingHeader(content, relPath) {
  const head = content.slice(0, 600);
  if (head.includes(relPath)) return true;
  // existing block comment in first ~10 lines
  const first = content.split("\n").slice(0, 10).join("\n");
  if (/^[ \t]*(\/\/|\/\*|--|#|<!--)/.test(content.trimStart()) && /===/.test(first)) return true;
  return false;
}

function processFile(absPath) {
  const rel = path.relative(ROOT, absPath).split(path.sep).join("/");
  if (SKIP_EXACT.has(rel)) return "skip:exact";
  const ext = path.extname(rel).slice(1).toLowerCase();
  const style = COMMENT_STYLES[ext];
  if (!style) return "skip:ext";

  const content = fs.readFileSync(absPath, "utf8");
  if (hasExistingHeader(content, rel)) return "skip:has-header";

  const lines = describe(rel);
  // prepend file path as first line for traceability
  const headerLines = [rel, ...lines];
  const header = wrap(style, headerLines);

  let out;
  const split = content.split("\n");
  // preserve leading directives (use client / shebang / @ts-...)
  let i = 0;
  while (i < split.length && (split[i].trim() === "" || isDirective(split[i]))) i++;
  if (i > 0) {
    out = split.slice(0, i).join("\n") + "\n" + header + split.slice(i).join("\n");
  } else {
    out = header + content;
  }
  fs.writeFileSync(absPath, out);
  return "wrote";
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
}

const targets = [];
walk(path.join(ROOT, "src"), targets);
if (fs.existsSync(path.join(ROOT, "supabase"))) walk(path.join(ROOT, "supabase"), targets);
if (fs.existsSync(path.join(ROOT, "scripts"))) walk(path.join(ROOT, "scripts"), targets);

// root-level files (non-recursive)
for (const f of ["vite.config.ts", "eslint.config.js"]) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p)) targets.push(p);
}
// root-level md files
for (const f of fs.readdirSync(ROOT)) {
  if (f.toLowerCase().endsWith(".md")) targets.push(path.join(ROOT, f));
}
if (fs.existsSync(path.join(ROOT, ".lovable/plan.md"))) {
  targets.push(path.join(ROOT, ".lovable/plan.md"));
}

const counts = {};
for (const f of targets) {
  const r = processFile(f);
  counts[r] = (counts[r] || 0) + 1;
}
console.log(JSON.stringify(counts, null, 2));
