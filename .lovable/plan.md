
# Onboarding Tour — סיור מודרך למשתמשים חדשים

סיור אינטראקטיבי בן 5-6 שלבים שמדריך משתמשים חדשים בפעם הראשונה שהם נכנסים למערכת. ללא תלויות חיצוניות — מימוש עצמאי עם spotlight + tooltip.

## חוויית המשתמש

- בכניסה ראשונה ל-`/projects` (אם אין `onboarding_completed` ב-localStorage), מופיע overlay כהה חצי-שקוף עם "חור" (spotlight) סביב האלמנט הנוכחי.
- ליד האלמנט מופיע כרטיס tooltip עם: כותרת, תיאור קצר, מספר שלב (1/6), כפתורי "הבא"/"חזרה"/"דלג".
- בסיום: toast "סיור הושלם 🎉" + שמירה ב-localStorage.
- כפתור "סיור מודרך" קבוע ב-Settings וב-help menu — מאפשר להפעיל שוב בכל עת.

## שלבי הסיור

1. **ברוך הבא** — מודאל מרכזי (ללא spotlight) עם הסבר קצר על המערכת + CTA "בוא נתחיל".
2. **כפתור פרויקט חדש** — spotlight על "פרויקט חדש" בעמוד `/projects`.
3. **חיפוש גלובלי** — spotlight על `CommandTriggerButton` בכותרת (Cmd+K).
4. **אחרונים** — spotlight על `RecentItemsMenu`.
5. **תפריט משתמש / הגדרות** — spotlight על `UserMenu`.
6. **סיום** — מודאל מרכזי "מוכן להתחיל!" עם קישור לפרויקט לדוגמה / יצירת פרויקט ראשון.

במובייל (זיהוי לפי `matchMedia`): מדלגים על שלבי "חיפוש/אחרונים/משתמש" שמוסתרים, ומציגים שלב חלופי שמצביע על `MobileBottomNav`.

## ארכיטקטורה טכנית

**קבצים חדשים:**

- `src/components/onboarding/onboarding-provider.tsx` — Context שמנהל `currentStep`, `isActive`, `start()`, `next()`, `prev()`, `skip()`, `complete()`. מאוחסן ב-`localStorage` תחת `onboarding_completed_v1`.
- `src/components/onboarding/onboarding-overlay.tsx` — ה-overlay עצמו:
  - `position: fixed inset-0 z-[100]` עם `pointer-events-auto`.
  - מחשב `getBoundingClientRect()` של היעד (לפי `data-tour` attribute), מצייר 4 div כהים סביבו ליצירת spotlight (ללא SVG clip-path כדי לתמוך בכל הדפדפנים).
  - tooltip ממוקם דינמית (מעל/מתחת ליעד לפי מקום פנוי).
  - מאזין ל-`resize` + `scroll` ומחשב מחדש.
  - `Esc` = skip; חיצים = ניווט.
- `src/components/onboarding/tour-steps.ts` — מערך השלבים: `{ id, target?: string, title, description, placement?: 'top'|'bottom'|'center' }`.
- `src/components/onboarding/restart-tour-button.tsx` — כפתור קטן להפעלה מחדש (יוצב ב-Settings).

**קבצים שמתעדכנים:**

- `src/routes/_authenticated.tsx` — עוטף את ה-`<main>` ב-`<OnboardingProvider>` + מרנדר `<OnboardingOverlay />`. מוסיף `data-tour="header-search"` ל-`CommandTriggerButton wrapper`, `data-tour="header-recent"` ל-`RecentItemsMenu`, `data-tour="user-menu"` ל-`UserMenu`, `data-tour="mobile-nav"` ל-`MobileBottomNav`.
- `src/routes/_authenticated/projects.index.tsx` — מוסיף `data-tour="new-project-btn"` לכפתור יצירת פרויקט; ב-`useEffect` קורא ל-`start()` אם זו כניסה ראשונה.
- `src/routes/_authenticated/settings.tsx` — מוסיף section "סיור מודרך" עם `<RestartTourButton />`.

## פרטים טכניים

- **אין שינויי DB ואין server functions** — הכל client-side ב-localStorage.
- **Semantic tokens בלבד**: `bg-background/80 backdrop-blur-sm` ל-overlay, `bg-card border-border` ל-tooltip, `text-primary` להדגשות, `bg-primary text-primary-foreground` ל-CTA.
- **A11y**: `role="dialog"` + `aria-labelledby` ל-tooltip, focus trap בסיסי, `Esc` סוגר.
- **RTL**: כל הטקסטים בעברית, כפתורי next/prev מסודרים נכון (next משמאל ב-RTL).
- **Spotlight ללא clip-path**: 4 overlays (top/bottom/left/right) שמכסים את כל המסך חוץ מהיעד — תאימות מלאה, פשוט יותר מ-SVG mask.
- **תזמון**: ה-overlay מחכה 300ms לפני שלב ראשון כדי לוודא שה-DOM מוכן; בכל מעבר בודק שהיעד קיים, אחרת מדלג.

## קבצים — סיכום

**נוצרים (4):**
- `src/components/onboarding/onboarding-provider.tsx`
- `src/components/onboarding/onboarding-overlay.tsx`
- `src/components/onboarding/tour-steps.ts`
- `src/components/onboarding/restart-tour-button.tsx`

**עורכים (3):**
- `src/routes/_authenticated.tsx`
- `src/routes/_authenticated/projects.index.tsx`
- `src/routes/_authenticated/settings.tsx`
