import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

type BadgeTone = "neutral" | "brand" | "info" | "success" | "warning" | "danger";

const tones: Record<BadgeTone, string> = {
  brand: "bg-[#eef2ff] text-[#4f46e5]",
  danger: "bg-[#fee4e2] text-[#b42318]",
  info: "bg-[#e0f2fe] text-[#0369a1]",
  neutral: "bg-[#f2f4f7] text-[#667085]",
  success: "bg-[#e0f2fe] text-[#0369a1]",
  warning: "bg-[#fff7df] text-[#b86b00]",
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold leading-none", tones[tone], className)}>
      {children}
    </span>
  );
}
