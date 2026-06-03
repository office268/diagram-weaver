## הסרה

ב-`src/routes/_authenticated.tsx` — הסרת ה-wrapper `<div data-tour="mobile-nav"><MobileBottomNav /></div>` והייבוא של `MobileBottomNav`. בנוסף, הסרת ה-padding התחתון `pb-16 md:pb-0` מה-`<main>` (לא נחוץ יותר כי אין בר תחתון).

קובץ `src/components/mobile-bottom-nav.tsx` יישאר במקום (לא מיובא ממקום אחר), כדי לאפשר החזרה בקלות.