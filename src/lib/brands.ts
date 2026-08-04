import { supabase } from "./supabase";
import { slugify } from "./products";
import type { BrandFull } from "../types/catalogue";

export type BrandInput = {
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  position: number;
};

/** Mirrors the DB rules so the form can flag problems before the round-trip. */
export function validateBrand(
  input: BrandInput,
  existing: BrandFull[],
  editingId?: string
): string | null {
  if (!input.name.trim()) return "Name is required.";
  if (!input.slug.trim()) return "Slug is required.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug))
    return "Slug must be lowercase words separated by hyphens.";

  // slug is UNIQUE in the schema — catch the clash before Postgres does.
  const clash = existing.some(
    (b) => b.slug === input.slug && b.id !== editingId
  );
  if (clash) return "That slug is already used by another brand.";

  return null;
}

export async function createBrand(
  input: BrandInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("brands").insert(input);
  return { error: error?.message ?? null };
}

export async function updateBrand(
  id: string,
  input: BrandInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("brands").update(input).eq("id", id);
  return { error: error?.message ?? null };
}

/**
 * Delete a brand. Products referencing it are NOT deleted — the FK is
 * ON DELETE SET NULL, so they simply lose their brand.
 */
export async function deleteBrand(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("brands").delete().eq("id", id);
  return { error: error?.message ?? null };
}

/** How many products carry a brand (used to warn before deleting). */
export async function countBrandProducts(id: string): Promise<number> {
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("brand_id", id);
  return count ?? 0;
}

export { slugify };
