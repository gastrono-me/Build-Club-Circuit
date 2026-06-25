"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { colors, radii, shadows, fonts, fontSize, fontWeight, spacing } from "@/lib/design/tokens";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Optional header title. */
  title?: string;
  children: React.ReactNode;
  /** Max width of the panel in px. Defaults to 420 (mobile-first sheet). */
  maxWidth?: number;
}

export function Modal({ open, onClose, title, children, maxWidth = 420 }: ModalProps) {
  // Escape to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,20,60,0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[4],
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface,
          border: `1.5px solid ${colors.ink}`,
          borderRadius: radii["2xl"],
          boxShadow: shadows.modal,
          width: "100%",
          maxWidth,
          maxHeight: "min(82vh, 640px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              padding: "14px 16px",
              borderBottom: `1.5px solid ${colors.ink}`,
              background: colors.panel,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                fontFamily: fonts.display,
                fontWeight: fontWeight.semibold,
                fontSize: fontSize.heading,
                color: colors.ink,
              }}
            >
              {title}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                color: colors.muted,
                display: "flex",
                padding: 2,
                borderRadius: radii.sm,
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={19} />
            </button>
          </div>
        )}
        <div style={{ overflowY: "auto", padding: spacing[5] }}>{children}</div>
      </div>
    </div>
  );
}

export default Modal;
