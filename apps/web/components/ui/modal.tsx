"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function Modal({
  children,
  footer,
  isOpen,
  onClose,
  title,
}: {
  children: ReactNode;
  footer?: ReactNode;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex h-[100svh] items-center justify-center overflow-hidden bg-[#101828]/45 p-2 backdrop-blur-md sm:p-4"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="flex max-h-[calc(100svh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[22px] border border-[#dfe5ec] bg-white/96 shadow-[0_30px_80px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:max-h-[min(92svh,760px)]"
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            initial={{ opacity: 0, scale: 0.96, y: 22 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e1e5eb] px-4 py-3.5">
              <h2 className="text-base font-semibold text-[#1f242d]">{title}</h2>
              <Button aria-label="Cerrar modal" icon={X} onClick={onClose} size="icon" variant="secondary" />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{children}</div>
            {footer ? <div className="shrink-0 border-t border-[#e1e5eb] bg-[#fbfcfd] px-4 py-3.5">{footer}</div> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
