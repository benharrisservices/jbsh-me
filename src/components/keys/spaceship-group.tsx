"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { SpaceshipCredentials } from "@/content/keys";
import { useKeysVisible } from "@/components/keys/keys-visibility";
import { cn } from "@/lib/utils";

interface SpaceshipGroupProps {
  credentials: SpaceshipCredentials;
  index: number;
}

export function SpaceshipGroup({ credentials, index }: SpaceshipGroupProps) {
  const keysVisible = useKeysVisible();
  const [copiedField, setCopiedField] = useState<"username" | "password" | null>(
    null,
  );

  const handleCopy = async (field: "username" | "password", value: string) => {
    if (!keysVisible) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // Clipboard unavailable
    }
  };

  const fields = [
    {
      key: "username" as const,
      label: "Username",
      value: credentials.username,
    },
    {
      key: "password" as const,
      label: "Password",
      value: credentials.password,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: (index % 4) * 0.05 }}
      className="border-b border-foreground/[0.06] py-5"
    >
      <p className="mb-4 text-[11px] tracking-[0.15em] text-muted-foreground uppercase">
        Spaceship
      </p>
      <div className="space-y-4">
        {fields.map((field) => {
          const hidden = !keysVisible;
          const displayValue = hidden ? "••••••••" : field.value;
          const copied = copiedField === field.key;

          return (
            <div
              key={field.key}
              className="group flex items-baseline justify-between gap-6"
            >
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
                  {field.label}
                </p>
                <p
                  className={cn(
                    "truncate font-mono text-sm text-foreground/85",
                    hidden && "tracking-widest text-foreground/40",
                  )}
                >
                  {displayValue}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    void handleCopy(field.key, field.value);
                  }}
                  disabled={!keysVisible}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={
                    !keysVisible
                      ? `Show keys before copying ${field.label}`
                      : copied
                        ? "Copied"
                        : `Copy ${field.label}`
                  }
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {copied ? (
                      <motion.span
                        key="check"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-500/80" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="copy"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
