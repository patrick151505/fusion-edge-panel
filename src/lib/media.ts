import { supabase } from "./supabase";

export const MEDIA_BUCKET = "media";

export type MediaFile = {
  name: string;
  /** Path within the bucket (currently same as name; kept for future folders). */
  path: string;
  url: string;
  size: number;
  createdAt: string | null;
};

const storage = () => supabase.storage.from(MEDIA_BUCKET);

/** Public URL for a stored object. The bucket is public, so this loads directly. */
export function publicUrl(path: string): string {
  return storage().getPublicUrl(path).data.publicUrl;
}

/** A filesystem-safe, collision-resistant name that keeps the extension. */
function safeName(original: string): string {
  const dot = original.lastIndexOf(".");
  const ext = dot >= 0 ? original.slice(dot).toLowerCase() : "";
  const base = (dot >= 0 ? original.slice(0, dot) : original)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "file";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${base}-${stamp}${rand}${ext}`;
}

export async function uploadFile(
  file: File
): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith("image/")) {
    return { url: null, error: "Only image files are allowed." };
  }
  const path = safeName(file.name);
  const { error } = await storage().upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
  });
  if (error) return { url: null, error: error.message };
  return { url: publicUrl(path), error: null };
}

/**
 * Overwrite an existing object in place (used when saving an edit).
 *
 * The public URL is unchanged, so the CDN/browser would keep serving the old
 * bytes for up to cacheControl seconds. We return a cache-busted URL
 * (`?v=timestamp`) so the fresh image shows immediately wherever the caller
 * stores it. The bare (unversioned) URL still points at the new file too.
 */
export async function overwriteFile(
  path: string,
  blob: Blob,
  contentType: string
): Promise<{ url: string | null; error: string | null }> {
  const { error } = await storage().upload(path, blob, {
    upsert: true,
    cacheControl: "3600",
    contentType,
  });
  if (error) return { url: null, error: error.message };
  return { url: `${publicUrl(path)}?v=${Date.now()}`, error: null };
}

export async function listFiles(): Promise<{
  files: MediaFile[];
  error: string | null;
}> {
  const { data, error } = await storage().list("", {
    limit: 200,
    sortBy: { column: "created_at", order: "desc" },
  });
  if (error) return { files: [], error: error.message };

  const files = (data ?? [])
    // list() can return a placeholder folder row with no id — skip it.
    .filter((o) => o.id !== null)
    .map((o) => ({
      name: o.name,
      path: o.name,
      url: publicUrl(o.name),
      size: o.metadata?.size ?? 0,
      createdAt: o.created_at ?? null,
    }));
  return { files, error: null };
}

export async function deleteFile(path: string): Promise<{ error: string | null }> {
  const { error } = await storage().remove([path]);
  return { error: error?.message ?? null };
}
