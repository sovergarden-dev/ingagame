export const LOCALES = [
  { code: "en", label: "English", native: "English" },
  { code: "vi", label: "Vietnamese", native: "Tiếng Việt" },
  { code: "zh-CN", label: "Simplified Chinese", native: "简体中文" },
  { code: "ja", label: "Japanese", native: "日本語" },
  { code: "ko", label: "Korean", native: "한국어" },
  { code: "es", label: "Spanish", native: "Español" },
  { code: "pt-BR", label: "Brazilian Portuguese", native: "Português (BR)" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export const DEFAULT_LOCALE: LocaleCode = "en";

export function isLocaleCode(value: string | null): value is LocaleCode {
  return LOCALES.some((locale) => locale.code === value);
}
