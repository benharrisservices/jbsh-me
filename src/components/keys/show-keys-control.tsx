"use client";

import { Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShowKeysControlProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
  className?: string;
}

/**
 * Compact reveal switch for Toolkit credentials — same restrained language
 * as the theme switch, with eye icons and Show/Hide Keys labels.
 */
export function ShowKeysControl({
  visible,
  onChange,
  className,
}: ShowKeysControlProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={visible}
      aria-label={visible ? "Hide keys" : "Show keys"}
      onClick={() => onChange(!visible)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!visible);
        }
      }}
      className={cn(
        "group flex items-center gap-3 rounded-full border border-foreground/10 bg-foreground/[0.04] px-3 py-2 backdrop-blur-md transition-colors hover:bg-foreground/[0.07]",
        className,
      )}
    >
      <span className="flex h-[22px] w-[38px] items-center rounded-full border border-foreground/10 bg-foreground/[0.06] px-[3px]"
        style={{ justifyContent: visible ? "flex-end" : "flex-start" }}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-foreground text-background shadow-sm"
        >
          {visible ? (
            <Eye className="h-2.5 w-2.5" aria-hidden />
          ) : (
            <EyeOff className="h-2.5 w-2.5" aria-hidden />
          )}
        </motion.span>
      </span>
      <span className="text-[11px] tracking-[0.14em] text-foreground/55 uppercase transition-colors group-hover:text-foreground/75">
        {visible ? "Hide Keys" : "Show Keys"}
      </span>
    </button>
  );
}
