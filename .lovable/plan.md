# תיקון גרירת סעיפי האפיון במובייל

## הבעיה
בעורך (`src/routes/_authenticated/editor.$id.tsx`) ה‑`DndContext` מוגדר עם `PointerSensor` ו‑`KeyboardSensor` בלבד. במובייל (הצפייה הנוכחית 384px), אירועי `pointer` של גרירה מתנגשים עם הגלילה הטבעית של הדפדפן ולכן הדפדפן מבטל את הגרירה מיד אחרי שהיא מתחילה — בדיוק מה שרואים ב‑session replay ("Dragging was cancelled" אחרי `Picked up draggable item`).

`@dnd-kit` מטפל בזה ע"י `TouchSensor` עם `activationConstraint.delay` — לחיצה ארוכה (~200ms) שמבדילה בין כוונה לגרור לבין גלילה.

## השינוי
ב‑`src/routes/_authenticated/editor.$id.tsx`:

1. להוסיף `TouchSensor` ו‑`MouseSensor` לייבוא מ‑`@dnd-kit/core`.
2. להחליף את הגדרת ה‑sensors כך:
   - `MouseSensor` עם `activationConstraint: { distance: 5 }` (דסקטופ — גרירה מיידית אחרי 5px).
   - `TouchSensor` עם `activationConstraint: { delay: 200, tolerance: 8 }` (מובייל — long‑press קצר, סובלנות תזוזה כדי לא לבטל בגלל רעש אצבע).
   - להשאיר את `KeyboardSensor`.
   - להסיר את ה‑`PointerSensor` (מיותר ויוצר את ההתנגשות).

זה הדפוס הסטנדרטי של dnd-kit לסביבות עם מסך מגע + עכבר.

## בדיקה
- דסקטופ: גרירה רגילה של ידית הסעיף עדיין עובדת מיד.
- מובייל: long‑press קצר על ידית ה‑grip ואז גרירה — בלי שהגלילה מבטלת את הפעולה.

## קבצים מושפעים
- `src/routes/_authenticated/editor.$id.tsx` (ייבוא + `dndSensors` בלבד; ללא שינויי לוגיקה אחרים).
