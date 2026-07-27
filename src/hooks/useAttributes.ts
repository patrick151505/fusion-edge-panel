import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AttributeWithTerms } from "../types/catalogue";

const byPos = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

/**
 * The attribute pool for a builder.
 *
 * Global terms (product_id IS NULL) are always included. When `productId` is
 * given, that product's own private terms are included too, and other
 * products' private terms are excluded — so a product only ever sees the
 * shared library plus its own custom values.
 *
 * Omit `productId` (e.g. the Attributes admin page) to see global terms only.
 */
export function useAttributes(productId?: string) {
  const [attributes, setAttributes] = useState<AttributeWithTerms[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Filter the nested terms: globals, plus this product's own if given.
    const termFilter = productId
      ? `product_id.is.null,product_id.eq.${productId}`
      : `product_id.is.null`;

    const { data } = await supabase
      .from("attributes")
      .select(
        `
        id, name, slug, display_type, position,
        terms:attribute_terms ( id, name, slug, swatch, position, product_id )
      `
      )
      .or(termFilter, { referencedTable: "attribute_terms" })
      .order("position");

    const rows = (data ?? []).map((a) => ({
      ...a,
      terms: [...((a as AttributeWithTerms).terms ?? [])].sort(byPos),
    })) as AttributeWithTerms[];

    setAttributes(rows.sort(byPos));
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    load();
  }, [load]);

  return { attributes, loading, reload: load };
}
