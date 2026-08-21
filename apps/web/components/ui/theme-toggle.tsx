"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sparkles, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  isSpulsoTheme,
  themeStorageKey,
  themeStorageKeyForUser,
  type SpulsoTheme,
} from "@/lib/theme";

const themeOptions: Array<{
  icon: typeof Sun;
  label: string;
  title: string;
  value: SpulsoTheme;
}> = [
  { icon: Sun, label: "Claro", title: "Modo claro", value: "light" },
  { icon: Moon, label: "Dark", title: "Modo dark elegante", value: "dark" },
  { icon: Sparkles, label: "Estrella", title: "Modo estrella suave", value: "star" },
];

type ThemeToggleProps = {
  initialTheme?: SpulsoTheme | null;
  userKey?: string | null;
};

export function ThemeToggle({ initialTheme, userKey }: ThemeToggleProps) {
  const [theme, setTheme] = useState<SpulsoTheme>("light");
  const [ready, setReady] = useState(false);
  const userThemeKey = useMemo(() => themeStorageKeyForUser(userKey), [userKey]);

  useEffect(() => {
    const storedUserTheme = window.localStorage.getItem(userThemeKey);
    const storedTheme = storedUserTheme ?? window.localStorage.getItem(themeStorageKey);
    const nextTheme = isSpulsoTheme(initialTheme)
      ? initialTheme
      : isSpulsoTheme(storedTheme)
        ? storedTheme
        : "light";

    applyTheme(nextTheme);
    persistLocalTheme(nextTheme, userThemeKey);
    setTheme(nextTheme);
    setReady(true);
  }, [initialTheme, userThemeKey]);

  function selectTheme(nextTheme: SpulsoTheme) {
    applyTheme(nextTheme);
    persistLocalTheme(nextTheme, userThemeKey);
    setTheme(nextTheme);
    void persistRemoteTheme(nextTheme);
  }

  return (
    <div
      aria-label="Selector de tema visual"
      className="spulso-theme-toggle spulso-interactive relative grid h-9 grid-cols-3 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-1 shadow-sm"
      role="group"
    >
      <motion.span
        animate={{ x: `${themeOptions.findIndex((option) => option.value === theme) * 100}%` }}
        className="absolute bottom-1 left-1 top-1 w-[calc((100%_-_0.5rem)/3)] rounded-lg bg-[var(--brand-soft)] shadow-sm"
        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      />
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const active = option.value === theme;

        return (
          <button
            aria-label={option.title}
            aria-pressed={active}
            className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition hover:text-[var(--brand)] ${
              active ? "text-[var(--brand)]" : ""
            }`}
            key={option.value}
            onClick={() => selectTheme(option.value)}
            title={option.title}
            type="button"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 45, scale: 0.72 }}
                initial={{ opacity: ready ? 0 : 1, rotate: -45, scale: ready ? 0.72 : 1 }}
                key={`${option.value}-${active}`}
                transition={{ duration: 0.16 }}
              >
                <Icon className="h-4 w-4" />
              </motion.span>
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}

function applyTheme(theme: SpulsoTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function persistLocalTheme(theme: SpulsoTheme, userThemeKey: string) {
  window.localStorage.setItem(themeStorageKey, theme);
  window.localStorage.setItem(userThemeKey, theme);
}

async function persistRemoteTheme(themePreference: SpulsoTheme) {
  try {
    await fetch("/api/spulso/auth/theme", {
      body: JSON.stringify({ themePreference }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    });
  } catch {
    // Local cache keeps the UI responsive; the next authenticated change can retry.
  }
}
