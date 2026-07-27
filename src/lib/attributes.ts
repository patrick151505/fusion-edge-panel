import { supabase } from "./supabase";
import { slugify } from "./products";
import type {
  AttributeTerm,
  AttributeWithTerms,
  DisplayType,
} from "../types/catalogue";

/** A product's assignment of one global attribute: which terms, and its role. */
export type AttributeAssignment = {
  attribute_id: string;
  used_for_variations: boolean;
  term_ids: string[];
  /** Term preselected on the product page. Null means no default. */
  default_term_id?: string | null;
};

/** How many products currently use a given attribute. */
export async function countAttributeUsage(
  attributeId: string
): Promise<number> {
  const { count } = await supabase
    .from("product_attributes")
    .select("id", { count: "exact", head: true })
    .eq("attribute_id", attributeId);
  return count ?? 0;
}

/**
 * Delete a global attribute. Cascades to its terms and to any product links
 * (product_attributes → product_attribute_terms), so callers should warn
 * when the attribute is still in use.
 */
export async function deleteAttribute(
  attributeId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("attributes")
    .delete()
    .eq("id", attributeId);
  return { error: error?.message ?? null };
}

/** Delete a single term (value) from an attribute. */
export async function deleteTerm(
  termId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("attribute_terms")
    .delete()
    .eq("id", termId);
  return { error: error?.message ?? null };
}

/**
 * Update an attribute's name and how it renders.
 *
 * The slug is deliberately left alone: it is referenced by URLs and existing
 * data, and renaming "Colour" to "Color" shouldn't break those.
 */
export async function updateAttribute(
  attributeId: string,
  name: string,
  display_type: DisplayType
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("attributes")
    .update({ name: name.trim(), display_type })
    .eq("id", attributeId);
  return { error: error?.message ?? null };
}

/** Rename a single term (value), e.g. "Oak" -> "Light Oak". */
export async function updateTerm(
  termId: string,
  name: string,
  swatch: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("attribute_terms")
    .update({ name: name.trim(), swatch })
    .eq("id", termId);
  return { error: error?.message ?? null };
}

/** Create a new global attribute (Color, Material…). Returns the created row. */
export async function createAttribute(
  name: string,
  display_type: DisplayType
): Promise<{ data: AttributeWithTerms | null; error: string | null }> {
  const { data, error } = await supabase
    .from("attributes")
    .insert({ name: name.trim(), slug: slugify(name), display_type })
    .select("id, name, slug, display_type, position")
    .single();

  if (error || !data) return { data: null, error: error?.message ?? "Failed." };
  return { data: { ...data, terms: [] }, error: null };
}

/**
 * Add a term (value) to an attribute.
 *
 * Pass `productId` to make it private to that product (WooCommerce's custom
 * value); leave it null and the value joins the global pool, available to
 * every product.
 */
export async function createTerm(
  attributeId: string,
  name: string,
  swatch: string | null,
  productId: string | null = null
): Promise<{ data: AttributeTerm | null; error: string | null }> {
  const { data, error } = await supabase
    .from("attribute_terms")
    .insert({
      attribute_id: attributeId,
      name: name.trim(),
      slug: slugify(name),
      swatch: swatch?.trim() || null,
      product_id: productId,
    })
    .select("id, name, slug, swatch, position")
    .single();

  if (error || !data) return { data: null, error: error?.message ?? "Failed." };
  return { data, error: null };
}

/**
 * Replace a product's attribute assignments with the given set.
 *
 * The join tables have no clean upsert key for our shape, so we delete the
 * product's existing product_attributes (which cascades to
 * product_attribute_terms) and re-insert. Assignments with no terms are
 * skipped — an attribute offering nothing is meaningless.
 */
export async function syncProductAttributes(
  productId: string,
  assignments: AttributeAssignment[]
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase
    .from("product_attributes")
    .delete()
    .eq("product_id", productId);
  if (delErr) return { error: delErr.message };

  const valid = assignments.filter((a) => a.term_ids.length > 0);
  if (valid.length === 0) return { error: null };

  // Insert product_attributes, get their ids, then their chosen terms.
  const paRows = valid.map((a, position) => ({
    product_id: productId,
    attribute_id: a.attribute_id,
    used_for_variations: a.used_for_variations,
    position,
    // A default only makes sense if the product still offers that term, and
    // only for attributes that actually form variations.
    default_term_id:
      a.used_for_variations &&
      a.default_term_id &&
      a.term_ids.includes(a.default_term_id)
        ? a.default_term_id
        : null,
  }));

  const { data: inserted, error: paErr } = await supabase
    .from("product_attributes")
    .insert(paRows)
    .select("id, attribute_id");
  if (paErr || !inserted) return { error: paErr?.message ?? "Failed." };

  const idByAttribute = new Map(
    inserted.map((r) => [r.attribute_id, r.id as string])
  );

  const patRows = valid.flatMap((a) => {
    const paId = idByAttribute.get(a.attribute_id);
    if (!paId) return [];
    return a.term_ids.map((term_id, position) => ({
      product_attribute_id: paId,
      term_id,
      position,
    }));
  });

  if (patRows.length > 0) {
    const { error: patErr } = await supabase
      .from("product_attribute_terms")
      .insert(patRows);
    if (patErr) return { error: patErr.message };
  }

  return { error: null };
}
