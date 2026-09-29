import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TierId } from "./types.js";
import { en } from "./locales/en.js";
import { vi, type Key } from "./locales/vi.js";

export type { Key } from "./locales/vi.js";

export type Lang = "vi" | "en";
const STORAGE_KEY = "ranking.lang";

const DICTS: Record<Lang, Record<Key, string>> = { vi, en };

export type Params = Record<string, string | number>;
export type T = (key: Key, params?: Params) => string;

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

function detect(): Lang {
  // ?lang=en lets a link open in a chosen language
  const forced = new URLSearchParams(location.search).get("lang");
  if (forced === "vi" || forced === "en") return forced;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    /* storage blocked by the browser */
  }
  return navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
  tierName: (id: TierId) => string;
  /** Falls back to the server's own message when an error code has no translation. */
  tError: (code: string, fallback: string, params?: Params) => string;
  locale: string;
}

const Ctx = createContext<LangContext | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* nothing we can do if storage is blocked */
    }
  }, []);

  const value = useMemo<LangContext>(() => {
    const dict = DICTS[lang];
    const t: T = (key, params) => format(dict[key] ?? key, params);
    return {
      lang,
      setLang,
      t,
      locale: lang === "vi" ? "vi-VN" : "en-GB",
      tierName: (id) => t(`tier.${id}` as Key),
      tError: (code, fallback, params) => {
        const key = `err.${code}` as Key;
        return key in dict ? format(dict[key], params) : fallback;
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("LangProvider is missing");
  return ctx;
}

/** For the shell, which shows sign-in errors before LangProvider mounts. */
export function translate(key: Key, params?: Params): string {
  return format(DICTS[detect()][key], params);
}
