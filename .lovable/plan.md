
# מעבר לפלט Markdown חופשי לסוכני האפיון

## מטרה
- להסיר את האילוץ להחזיר JSON מהסוכנים שמייצרים תוכן (Requirements, Architecture, Data Model, Use Cases).
- לתת ל-Gemini להחזיר Markdown טבעי לפי ברירת המחדל שלו — בלי `JSON_ONLY_INSTRUCTION`, בלי "סכמת JSON לפלט", בלי `extractJson`/`JSON.parse` על תוכן.
- להשאיר JSON רק היכן שהוא חיוני: התרשימים (RF-JSON) ושלב הביקורת (score+notes).
- במסמכים שיש בהם תרשים — לשריין מקום בטקסט שאליו ייכנס התרשים אחרי שייוצר.

לא יורדים תקני איכות: כל ה-system prompts, כללי החשיבה (THINKING), ה-self-critique, המינימומים (FRs ≥ 5 וכו') וההוראות לשפה עברית — נשמרים. רק פורמט הפלט משתנה מ-JSON ל-Markdown.

## מבנה האחסון של ה-Spec (החלטה)

`SpecOutput` יעבור ממבנה של מערכים מובְנים למבנה של **קטעי Markdown לפי סעיף**, עם תרשימים בשדות נפרדים שמפנים אליהם placeholders בתוך ה-Markdown:

```ts
type SpecOutput = {
  title: string;
  sections: {
    overview: string;            // Markdown
    goals: string;               // Markdown (רשימה)
    functional_requirements: string;     // Markdown
    non_functional_requirements: string; // Markdown
    assumptions: string;         // Markdown
    use_cases: string;           // Markdown — כולל placeholders לכל תרשים תרחיש
    architecture: string;        // Markdown — כולל {{diagram:architecture}}
    data_model: string;          // Markdown — כולל {{diagram:data_model}}
    risks: string;               // Markdown
  };
  diagrams: {
    architecture?: string;       // RF-JSON
    data_model?: string;         // RF-JSON
    use_cases: Array<{ key: string; title: string; diagram: string }>;
  };
};
```

תחביר ה-Placeholder בתוך ה-Markdown:
- `{{diagram:architecture}}`
- `{{diagram:data_model}}`
- `{{diagram:use_case:<key>}}` — `key` הוא slug יציב שנגזר מכותרת התרחיש (או אינדקס).

הסוכן שכותב סעיף עם תרשים מתבקש להכניס את ה-placeholder במקום המתאים. אם הוא לא הכניס — המערכת תוסיף אותו בסוף הסעיף כבר