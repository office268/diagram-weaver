## הבעיה

ב-`src/agents/orchestrator/index.server.ts`, לולאת השיפור (שורות 81–118) מריצה סוכנים משופרים אבל ממשיכה להעביר את המשתנים המקוריים (`requirements`, `useCases`, `architecture`, `dataModel`) לקריאות הבאות. כתוצאה מכך, גם אם הדרישות השתפרו, סוכן הארכיטקטורה והדיאגרמות באיטרציה הבאה עדיין רצים על הדרישות הישנות — והלולאה לא מתכנסת.

## התיקון

עדכון `src/agents/orchestrator/index.server.ts`:

1. החלפת `const` ב-`let` עבור `requirements`, `architecture`, `dataModel`, `useCases` בהגדרות הראשוניות (שלבים 2–4).
2. בתוך לולאת השיפור, אחרי כל ריצת סוכן משופר — לעדכן את המשתנה המקומי המתאים לפני שמשתמשים בו בקריאה הבאה:
   - אחרי `runRequirementsAgent` המשופר → `requirements = improved`
   - אחרי `runArchitectureAgent` המשופר → `architecture = improvedArch`
   - אחרי `runUseCasesAgent` המשופר → `useCases = improvedUC`
3. בקריאות ל-`runArchitectureAgent`, `runDiagramsAgent`, `runUseCasesAgent` בתוך הלולאה — להעביר את המשתנים המעודכנים (`requirements`, `useCases`, `architecture`, `dataModel`) במקום ערכי האיטרציה הראשונה.
4. גם להוסיף ריצה משופרת של `runDataModelAgent` כאשר יש הערות רלוונטיות (אופציונלי — כרגע לא מטופל בכלל בלולאה), או לפחות לוודא ש-`dataModel` מעודכן אם הארכיטקטורה השתנתה. לפי הבקשה המקורית — להתמקד רק בתיקון של הזרימה הקיימת.

## קבצים שמשתנים

- `src/agents/orchestrator/index.server.ts` בלבד.

לא נדרשות מיגרציות, שינויי UI, או שינויים בסוכנים עצמם.
