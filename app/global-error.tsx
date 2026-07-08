"use client"

import { useEffect } from "react"

/**
 * Root error boundary — catches errors thrown by the root layout itself, which
 * app/error.tsx (nested inside the layout) can't reach. Must render its own
 * <html>/<body>. Surfaces the real message so root-level crashes aren't opaque.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error]", error)
  }, [error])

  return (
    <html>
      <body style={{ margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#EEF1F4", color: "#14143C", fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}>
          <div style={{ maxWidth: 620, width: "100%", background: "#fff", border: "1.5px solid #14143C", borderRadius: 16, padding: 24 }}>
            <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2B2BF5", marginBottom: 8 }}>
              Something broke
            </div>
            <h1 style={{ fontSize: 22, margin: "0 0 12px", letterSpacing: "-0.02em" }}>The app hit an error</h1>
            <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "IBM Plex Mono, monospace", fontSize: 13, lineHeight: 1.5, background: "#F5F7F9", border: "1px solid #d7dde3", borderRadius: 8, padding: 12, margin: "0 0 8px" }}>
              {error?.message || "Unknown error"}
            </pre>
            {error?.digest && (
              <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                digest: {error.digest}
              </div>
            )}
            {error?.stack && (
              <details style={{ marginBottom: 16 }}>
                <summary style={{ cursor: "pointer", fontFamily: "IBM Plex Mono, monospace", fontSize: 12, color: "#6b7280" }}>Stack trace</summary>
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "IBM Plex Mono, monospace", fontSize: 11, lineHeight: 1.5, color: "#6b7280", marginTop: 8 }}>
                  {error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={reset}
              style={{ border: "1.5px solid #14143C", background: "#2B2BF5", color: "#fff", borderRadius: 8, padding: "9px 16px", fontFamily: "IBM Plex Mono, monospace", fontSize: 13, cursor: "pointer" }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
