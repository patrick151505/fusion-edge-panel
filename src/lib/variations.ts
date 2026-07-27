import type { ProductDetail, Variation } from "../types/catalogue";

/** attribute_id -> term_id chosen by the user. */
export type Selection = Record<string, string>;

/** The attributes that form variations, in display order. */
export function choiceAttributes(product: ProductDetail) {
  return product.attributes.filter((a) => a.used_for_variations);
}

/** The attributes shown as information only. */
export function specAttributes(product: ProductDetail) {
  return product.attributes.filter((a) => !a.used_for_variations);
}

function matches(variation: Variation, selection: Selection): boolean {
  const entries = Object.entries(selection);
  if (entries.length === 0) return false;
  return entries.every(([attributeId, termId]) =>
    variation.terms.some(
      (t) => t.attribute_id === attributeId && t.term_id === termId
    )
  );
}

/**
 * The variation matching a complete selection. Returns null until every
 * choice attribute has been picked — a partial selection is ambiguous.
 */
export function findVariation(
  product: ProductDetail,
  selection: Selection
): Variation | null {
  const needed = choiceAttributes(product);
  if (needed.length === 0) return null;
  if (needed.some((a) => !selection[a.attribute.id])) return null;

  return product.variations.find((v) => matches(v, selection)) ?? null;
}

/**
 * Term ids that lead to at least one real variation, given the other
 * choices already made. Used to disable combinations that are not sold.
 */
export function availableTerms(
  product: ProductDetail,
  selection: Selection,
  attributeId: string
): Set<string> {
  const others = Object.entries(selection).filter(
    ([id]) => id !== attributeId
  );

  const out = new Set<string>();
  for (const v of product.variations) {
    const compatible = others.every(([aId, tId]) =>
      v.terms.some((t) => t.attribute_id === aId && t.term_id === tId)
    );
    if (!compatible) continue;
    const term = v.terms.find((t) => t.attribute_id === attributeId);
    if (term) out.add(term.term_id);
  }
  return out;
}

/** Term ids that exist only on out-of-stock variations, given the rest. */
export function outOfStockTerms(
  product: ProductDetail,
  selection: Selection,
  attributeId: string
): Set<string> {
  const others = Object.entries(selection).filter(([id]) => id !== attributeId);

  const anyInStock = new Set<string>();
  const seen = new Set<string>();

  for (const v of product.variations) {
    const compatible = others.every(([aId, tId]) =>
      v.terms.some((t) => t.attribute_id === aId && t.term_id === tId)
    );
    if (!compatible) continue;
    const term = v.terms.find((t) => t.attribute_id === attributeId);
    if (!term) continue;
    seen.add(term.term_id);
    if (v.in_stock) anyInStock.add(term.term_id);
  }

  return new Set([...seen].filter((id) => !anyInStock.has(id)));
}
