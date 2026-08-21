"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      className="flex min-h-0 flex-1 flex-col"
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
