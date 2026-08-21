"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton({ redirectTo = "/login", showLabel = false }: { redirectTo?: string; showLabel?: boolean }) {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  async function handleLogout() {
    setIsLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <button
      aria-label="Cerrar sesión"
      className={
        showLabel
          ? "flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#e1e5eb] bg-white px-3 text-sm font-semibold text-[#475467] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f8fafc] disabled:opacity-60"
          : "flex h-9 w-9 items-center justify-center rounded-xl border border-[#e1e5eb] bg-white text-[#475467] shadow-sm transition hover:-translate-y-0.5 hover:bg-[#f8fafc] disabled:opacity-60"
      }
      disabled={isLeaving}
      onClick={handleLogout}
      title="Cerrar sesión"
      type="button"
    >
      <LogOut className="h-4 w-4" />
      {showLabel ? <span>Cerrar sesion</span> : null}
    </button>
  );
}
