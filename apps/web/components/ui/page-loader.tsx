"use client";

import { motion } from "framer-motion";
import { Activity, Sparkles } from "lucide-react";

export function PageLoader() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#f4f6f8] px-6">
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="premium-surface relative w-full max-w-md overflow-hidden rounded-[24px] p-5"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-[#eef2ff]">
          <motion.div
            animate={{ x: ["-40%", "170%"] }}
            className="h-full w-1/2 rounded-full bg-gradient-to-r from-[#38bdf8] via-[#4f46e5] to-[#93c5fd]"
            transition={{ duration: 1.05, ease: [0.65, 0, 0.35, 1], repeat: Infinity }}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#eef2ff] text-[#4f46e5]">
            <motion.span
              animate={{ rotate: 360 }}
              className="absolute h-[68px] w-[68px] rounded-full border border-transparent border-t-[#4f46e5] border-r-[#a5b4fc]"
              transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
            />
            <motion.span
              animate={{ rotate: -360 }}
              className="absolute h-12 w-12 rounded-full border border-transparent border-b-[#818cf8]"
              transition={{ duration: 1.8, ease: "linear", repeat: Infinity }}
            />
            <Activity className="relative h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#4f46e5]">
              <Sparkles className="h-3.5 w-3.5" />
              Cargando experiencia
            </div>
            <p className="mt-3 text-lg font-semibold text-[#20242c]">Preparando SPulso</p>
            <p className="mt-1 text-sm text-[#667085]">Organizando datos, permisos y modulos.</p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-full bg-[#eef2f7] p-1">
          <motion.div
            animate={{ x: ["-35%", "145%"] }}
            className="h-2 w-1/2 rounded-full bg-gradient-to-r from-[#818cf8] via-[#4f46e5] to-[#c7d2fe]"
            transition={{ duration: 1.15, ease: [0.65, 0, 0.35, 1], repeat: Infinity }}
          />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {["Empresas", "Personas", "Flujos"].map((label, index) => (
            <motion.div
              animate={{ opacity: [0.55, 1, 0.55], y: [0, -3, 0] }}
              className="rounded-2xl border border-[#e4e8f0] bg-white/80 p-3"
              key={label}
              transition={{ delay: index * 0.14, duration: 1.3, ease: "easeInOut", repeat: Infinity }}
            >
              <div className="h-2 w-10 rounded-full bg-[#c7d2fe]" />
              <div className="mt-3 h-2 w-full rounded-full bg-[#eef2f7]" />
              <p className="mt-3 text-[11px] font-bold text-[#667085]">{label}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
