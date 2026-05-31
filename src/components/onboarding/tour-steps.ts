export type TourPlacement = "top" | "bottom" | "center";

export interface TourStep {
  id: string;
  target?: string; // CSS selector (data-tour="...")
  title: string;
  description: string;
  placement?: TourPlacement;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "ברוכים הבאים לסוכן ניתוח מערכות 👋",
    description:
      "כאן הופכים טקסט חופשי לאפיון מובנה עם תרשימים. בואו נעבור יחד על המקומות החשובים — לוקח פחות מדקה.",
    placement: "center",
  },
  {
    id: "new-project",
    target: '[data-tour="new-project-btn"]',
    title: "יצירת פרויקט חדש",
    description:
      "כל פרויקט מאגד מסמכי אפיון מסוגים שונים. לחצו כאן כדי ליצור את הפרויקט הראשון שלכם.",
    placement: "bottom",
  },
  {
    id: "search",
    target: '[data-tour="header-search"]',
    title: "חיפוש גלובלי (⌘K)",
    description:
      "מאתר במהירות פרויקטים, מסמכים והגדרות. ניתן לפתוח גם בקיצור מקלדת ⌘K / Ctrl+K.",
    placement: "bottom",
    desktopOnly: true,
  },
  {
    id: "recent",
    target: '[data-tour="header-recent"]',
    title: "פריטים אחרונים",
    description: "גישה מהירה למסמכים והפרויקטים שעבדתם עליהם לאחרונה.",
    placement: "bottom",
    desktopOnly: true,
  },
  {
    id: "mobile-nav",
    target: '[data-tour="mobile-nav"]',
    title: "ניווט מהיר",
    description:
      "בתחתית המסך תמצאו גישה מהירה לפרויקטים, חיפוש, אחרונים והגדרות.",
    placement: "top",
    mobileOnly: true,
  },
  {
    id: "user-menu",
    target: '[data-tour="user-menu"]',
    title: "החשבון וההגדרות",
    description: "כאן ניתן לגשת להגדרות, להפעיל מחדש את הסיור ולהתנתק.",
    placement: "bottom",
  },
  {
    id: "finish",
    title: "מוכנים להתחיל! 🚀",
    description:
      "צרו פרויקט חדש או בחרו פרויקט קיים. תוכלו להפעיל את הסיור שוב מתוך מסך ההגדרות.",
    placement: "center",
  },
];

export const ONBOARDING_STORAGE_KEY = "onboarding_completed_v1";
