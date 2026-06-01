
# שדרוג Multi-Agent + RAG — תכנית מימוש

מאמץ את שלד האג'נטים של Claude ומתקן את כל מה שלא יעבוד אצלנו (Cloudflare Workers + TanStack). מחליף את ה-endpoint הקיים במקום להוסיף v2 במקביל, מחזיר streaming אמיתי, מתקן חיוב קרדיטים, ועושה RAG בצורה תואמת ל-Workers.

## אג'נטים בתכנון (8)
1. **Orchestrator** — מנהל את ה-pipeline והלולאה
2. **Context / RAG** — שולף chunks רלוונטיים
3. **Requirements** — דרישות, NFRs, סיכונים, הנחות
4. **Architecture** — רכיבים, אינטגרציות (במקביל ל-Data Model)
5. **Data Model** — ישויות, שדות, יחסים (במקביל ל-Architecture)
6. **Use Cases** — תרחישים, פרסונות, זרימות
7. **Diagrams** — Mermaid (flow / sequence / ER)
8. **Review** — ציון 1-10 + הערות ממוקדות

\+ עוזר: **Note Classifier** ממיין הערות review לאיזה אג'נט להריץ מחדש (מחליף את הפילטר מילות-המפתח השביר של Claude).

## שלב 1 — בסיס האג'נטים

- אמץ את `src/agents/*` של הברנץ' (orchestrator + 7 אג'נטים + shared).
- **שדרוג עקבי**: כל אג'נט עובד עם `generateText` + `Output.object` (סכמת Zod ייעודית) במקום JSON-by-prompt + `extractJson`.
- כל אג'נט בונה provider משלו בתוך ה-handler (לא module-level), לפי דפוס `ai-sdk-lovable-gateway`.
- ברירת מחדל למודל: `google/gemini-3-flash-preview`. אג'נט Review משתמש ב-`google/gemini-2.5-pro` (איכות שיפוט > מהירות).
- קונפיג ב-`shared/constants.ts`: `SCORE_THRESHOLD=8`, `MAX_ITERATIONS=2`.

## שלב 2 — Streaming אמיתי

מחליפים את `/api/generate-spec` הקיים (לא מוסיפים v2). ה-stream שולח אירועים מתויגים מופרדים ב-newline:

```
__STAGE__:requirements:start
__STAGE__:requirements:done
__PARTIAL__:{"section":"requirements","value":{...}}
__STAGE__:architecture:start
...
__REVIEW__:{"score":7,"notes":[...]}
__STAGE__:iterate:start
__FINAL__:{...full spec...}
__STREAM_ERROR__:<msg>   (פורמט קיים)
```

ה-frontend (parser ב-`src/lib/spec.functions.ts` + רכיב חדש `pipeline-progress.tsx`) מעדכן UI בזמן אמת — המשתמש רואה את הסעיפים מתמלאים.

## שלב 3 — חיוב קרדיטים הוגן

ריצה = ~6-10 קריאות LLM. RPC חדשה `consume_credits(_user_id, _amount)` שמחייבת N אטומית או מחזירה NULL.
- 3 קרדיטים בתחילת ריצה.
- +1 קרדיט לפני כל איטרציית שיפור (אם אין — מסיים עם מה שיש ומסמן "iteration_skipped:no_credits" ב-stream).

## שלב 4 — RAG תואם Workers

**הבעיה:** `pdf-parse` / `mammoth` / `@napi-rs/canvas` לא רצים ב-workerd.

**פתרון — חילוץ טקסט בצד הלקוח:**
- `pdfjs-dist` (ESM, browser) ל-PDF.
- `mammoth` ב-browser bundle ל-DOCX.
- TXT — קריאה ישירה.
- הלקוח שולח לשרת **טקסט נקי + מטא-דאטה** (שם, גודל, mime).

**Endpoint חדש `/api/ingest-document`** (POST, requireSupabaseAuth-flavored):
- Zod validation, chunking (800 טוקנים, חפיפה 100).
- Embeddings דרך Lovable AI Gateway: `POST /v1/embeddings` עם `google/gemini-embedding-001` (3072 dims).
- שמירה ב-`document_chunks` עם vector index.

**מיגרציות (Lovable Cloud):**
- `CREATE EXTENSION IF NOT EXISTS vector;`
- `uploaded_documents` (user_id, project_id, file_name, file_size, mime_type, status) — RLS לפי user_id + GRANTs.
- `document_chunks` (document_id, content, chunk_index, embedding vector(3072)) + HNSW index + RLS דרך document_id.
- RPC `match_document_chunks(user_id, project_id, query_embedding, match_count)`.
- RPC `consume_credits(_user_id, _amount)`.

**Retrieval ב-orchestrator:** top-6 chunks, מוגבל ל-~3000 טוקנים, מוזרק לאג'נטים שצריכים (Requirements + Architecture + UseCases).

## שלב 5 — חיבור UI

- **כרטיס חדש בעמוד הפרויקט** (`projects.$projectId.tsx`): "מסמכי הקשר" — drag&drop, רשימה, מחיקה.
- **`DocumentUploader` חדש** — מחלץ טקסט בלקוח, מציג progress, מעלה ל-`/api/ingest-document`.
- **`PipelineProgress` חדש בעורך** — מציג את 5 השלבים (Requirements → Arch/Data → UseCases → Diagrams → Review) במקום בר עמום.

## שלב 6 — ניקיון

- מחיקת `pdf-parse`, `mammoth` (node bundle), `@types/pdf-parse`, `@napi-rs/canvas` מ-`package.json`.
- הוספת `pdfjs-dist` ו-`mammoth` (browser bundle path).
- הסרת `require("pdf-parse")` (CJS require ב-ESM Worker = fail).

## קבצים

```
src/agents/                              ← אומץ + שדרוג ל-Output.object
  shared/note-classifier.server.ts       ← חדש
src/lib/rag/
  text-extractor.client.ts               ← חדש (pdfjs + mammoth browser)
  chunker.server.ts                      ← מהענף
  embedder.server.ts                     ← rewrite ל-/v1/embeddings ישיר
  ingest.server.ts                       ← מהענף, פושט
src/routes/api/
  generate-spec.ts                       ← מוחלף (orchestrator + tagged stream)
  ingest-document.ts                     ← חדש
  delete-document.ts                     ← מהענף
src/components/
  document-uploader.tsx                  ← חדש
  pipeline-progress.tsx                  ← חדש
src/lib/spec.functions.ts                ← parser לאירועים מתויגים
supabase/migrations/
  *_rag_setup.sql                        ← extension + 2 טבלאות + GRANTs + RLS
  *_match_chunks_rpc.sql
  *_consume_credits_rpc.sql
```

## סיכונים שעדיין פתוחים

1. **`pgvector` ב-Lovable Cloud** — אם `CREATE EXTENSION vector` נכשל, fallback ל-`tsvector + ts_rank` (RAG פחות חכם אבל עובד). נאמת בשלב הראשון של המיגרציה.
2. **Latency** — multi-agent איטי יותר (15-40 שניות מול 5-15). ה-tagged stream ממתן את זה ב-UX.
3. **גודל bundle בלקוח** — `pdfjs-dist` כבד (~1MB gzipped). נטען lazy רק כשפותחים את ה-uploader.

## מה לא נכלל

- Chat-style refinement, מציג ההקשר שנשלף בפועל, ניהול גרסאות לפי איטרציה — אפשר בהמשך.

מאשר להתחיל? אתחיל מהמיגרציה (שלב 4 בסיס) כי היא חוסמת את כל השאר.
