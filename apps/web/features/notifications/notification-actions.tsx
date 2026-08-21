"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, MailOpen, RotateCcw } from "lucide-react";
import { markNotificationAsRead, markNotificationAsUnread } from "./api";

export function NotificationReadButton({
  notificationId,
  read,
}: {
  notificationId: string;
  read: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isRead, setIsRead] = useState(read);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const previousState = isRead;
    setIsRead(!previousState);

    try {
      if (previousState) {
        await markNotificationAsUnread(notificationId);
      } else {
        await markNotificationAsRead(notificationId);
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (currentError) {
      setIsRead(previousState);
      setError(currentError instanceof Error ? currentError.message : "No se pudo actualizar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={`inline-flex h-8 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${
          isRead ? "bg-[#f2f4f7] text-[#667085]" : "bg-[#eef2ff] text-[#4f46e5]"
        }`}
      >
        {isRead ? <MailOpen className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {isRead ? "Leida" : "Nueva"}
      </span>
      <button
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#c7d2fe] bg-[#f7f7ff] px-3 text-xs font-semibold text-[#4f46e5] transition hover:bg-[#c7d2fe] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={loading || isPending}
        onClick={handleClick}
        type="button"
      >
        {loading || isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRead ? (
          <RotateCcw className="h-4 w-4" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        {isRead ? "Marcar no leida" : "Marcar leida"}
      </button>
      {error ? <span className="max-w-48 text-right text-[11px] font-medium text-[#b42318]">{error}</span> : null}
    </div>
  );
}
