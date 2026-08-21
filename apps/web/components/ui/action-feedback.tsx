"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CircleAlert, LoaderCircle, Sparkles } from "lucide-react";

type FeedbackTone = "loading" | "success" | "error";

export function ActionFeedback({
  message,
  tone,
}: {
  message: string;
  tone: FeedbackTone;
}) {
  const config = {
    loading: {
      className: "border-[#a5b4fc] bg-[#eef2ff] text-[#4f46e5] shadow-[0_12px_28px_rgba(79,70,229,0.12)]",
      icon: <LoaderCircle className="h-4 w-4 animate-spin" />,
      pulse: "bg-[#4f46e5]",
      bar: "from-[#818cf8] via-[#4f46e5] to-[#c7d2fe]",
    },
    success: {
      className: "border-[#bae6fd] bg-[#e0f2fe] text-[#0284c7] shadow-[0_12px_28px_rgba(2,132,199,0.12)]",
      icon: <CheckCircle2 className="h-4 w-4 animate-pop-success" />,
      pulse: "bg-[#0284c7]",
      bar: "from-[#7dd3fc] via-[#0284c7] to-[#bae6fd]",
    },
    error: {
      className: "border-[#fecdca] bg-[#fee4e2] text-[#b42318] shadow-[0_12px_28px_rgba(180,35,24,0.10)]",
      icon: <CircleAlert className="h-4 w-4" />,
      pulse: "bg-[#b42318]",
      bar: "from-[#fca5a5] via-[#b42318] to-[#fecaca]",
    },
  }[tone];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`relative flex min-h-11 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border px-3 py-2 text-xs font-semibold ${config.className}`}
        exit={{ opacity: 0, scale: 0.96, y: -4 }}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        key={`${tone}-${message}`}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {tone === "loading" ? (
          <span className="absolute inset-0 animate-shimmer opacity-60" />
        ) : null}

        <span className="relative flex w-full items-center gap-3">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70">
            {tone === "loading" ? (
              <>
                <span className={`absolute h-2 w-2 rounded-full ${config.pulse} opacity-30 motion-safe:animate-ping`} />
                <Sparkles className="absolute -right-1 -top-1 h-3 w-3 opacity-70" />
              </>
            ) : null}
            {config.icon}
          </span>
          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block whitespace-normal break-words leading-5">{message}</span>
            <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/60">
              <motion.span
                animate={tone === "loading" ? { x: ["-35%", "135%"] } : { x: "0%" }}
                className={`block h-full w-1/2 rounded-full bg-gradient-to-r ${config.bar}`}
                transition={tone === "loading" ? { duration: 1.05, ease: [0.65, 0, 0.35, 1], repeat: Infinity } : { duration: 0.28 }}
              />
            </span>
          </span>
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
