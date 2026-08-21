export const themeStorageKey = "spulso_theme_v3";

export const themes = ["light", "dark", "star"] as const;

export type SpulsoTheme = (typeof themes)[number];

export function isSpulsoTheme(value: unknown): value is SpulsoTheme {
  return typeof value === "string" && themes.includes(value as SpulsoTheme);
}

export function themeStorageKeyForUser(userKey?: string | null) {
  if (!userKey) {
    return themeStorageKey;
  }

  return `${themeStorageKey}:${userKey.toLowerCase()}`;
}
