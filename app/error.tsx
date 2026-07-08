"use client"

import { useEffect } from "react"

/**
 * Route-level error boundary. Next's default only shows a generic "Application
 * error" in production and buries the real message in the console. This surfaces
 * the actual message, digest, and stack on screen so a crash can be diagnosed
 * without console access (e.g. on mobile), and logs the full error too.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[route error]", error)
  }, [error])

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#EEF1F4", color: "#14143C", fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 620, width: "100%", background: "#fff", border: "1.5px solid #14143C", borderRadius: 16, padding: 24 }}>
        <div style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2B2BF5", marginBottom: 8 }}>
          Something broke
        </div>
        <h1 style={{ fontSize: 22, margin: "0 0 12px", letterSpacing: "-0.02em" }}>The page hit an error</h1>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "IBM Plex Mono, monospace", fontSize: 13, lineHeight: 1.5, background: "#F5F7F9", border: "1px solid #d7dde3", borderRadius: 8, padding: 12, margin: "0 0 8px", color: "#14143C" }}>
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
  )
}
