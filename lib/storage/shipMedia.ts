"use client"

import { createClient } from "@/lib/supabase/client"

/** Max upload size for a ship attachment. */
export const MAX_SHIP_MEDIA_BYTES = 10 * 1024 * 1024 // 10 MB

export interface ShipMedia {
  url: string
  type: string
  name: string
}

/** Filesystem-safe version of a filename, keeping the extension. */
function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file"
}

/**
 * Upload one file to the public `ships` bucket and return its public URL, mime
 * type, and original name. Throws on oversize or upload error.
 */
export async function uploadShipMedia(file: File): Promise<ShipMedia> {
  if (file.size > MAX_SHIP_MEDIA_BYTES) {
    throw new Error("That file is over 10 MB. Try a smaller one.")
  }
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")

  const path = `${user.id}/${Date.now()}-${safeName(file.name)}`
  const { error } = await supabase.storage
    .from("ships")
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from("ships").getPublicUrl(path)
  return { url: data.publicUrl, type: file.type || "application/octet-stream", name: file.name }
}

/** Normalize a pasted link: trim, and add https:// when a scheme is missing. */
export function normalizeLink(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v}`
}
