import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { updateSiteText } from "./site-texts.functions";

type Ctx = {
  texts: Record<string, string>;
  isAdmin: boolean;
  updateText: (key: string, value: string) => Promise<void>;
};

const SiteTextsContext = createContext<Ctx>({
  texts: {},
  isAdmin: false,
  updateText: async () => {},
});

export function SiteTextsProvider({
  initialTexts,
  isAdmin,
  children,
}: {
  initialTexts: Record<string, string>;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [texts, setTexts] = useState(initialTexts);
  const updateFn = useServerFn(updateSiteText);

  const updateText = useCallback(
    async (key: string, value: string) => {
      const prev = texts[key];
      setTexts((t) => ({ ...t, [key]: value }));
      try {
        await updateFn({ data: { key, value } });
        toast.success("נשמר");
      } catch (e) {
        setTexts((t) => ({ ...t, [key]: prev ?? "" }));
        toast.error(e instanceof Error ? e.message : "שמירה נכשלה");
      }
    },
    [texts, updateFn],
  );

  const value = useMemo(
    () => ({ texts, isAdmin, updateText }),
    [texts, isAdmin, updateText],
  );

  return <SiteTextsContext.Provider value={value}>{children}</SiteTextsContext.Provider>;
}

export function useSiteTexts() {
  return useContext(SiteTextsContext);
}
