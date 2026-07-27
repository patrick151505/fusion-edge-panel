import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { ProductDetail } from "../types/catalogue";

const SELECT = `
  id, name, slug, sku, kind, description, short_description,
  price_cents, sale_price_cents, price_max_cents,
  in_stock, featured, published, created_at,
  category:categories ( id, name, slug ),
  images:product_images ( id, url, alt, position, variation_id ),
  product_attributes (
    id, used_for_variations, position, default_term_id,
    attribute:attributes ( id, name, slug, display_type, position ),
    product_attribute_terms (
      id, position,
      term:attribute_terms ( id, name, slug, swatch, position )
    )
  ),
  variations (
    id, sku, price_cents, sale_price_cents, in_stock, position,
    variation_terms ( attribute_id, term_id )
  )
`;

const byPosition = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

/** Flattens the nested join rows into the shapes the UI works with. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(row: any): ProductDetail {
  return {
    ...row,
    images: [...(row.images ?? [])].sort(byPosition),
    attributes: [...(row.product_attributes ?? [])]
      .sort(byPosition)
      .map((pa: any) => ({
        id: pa.id,
        used_for_variations: pa.used_for_variations,
        default_term_id: pa.default_term_id ?? null,
        position: pa.position,
        attribute: pa.attribute,
        terms: [...(pa.product_attribute_terms ?? [])]
          .sort(byPosition)
          .map((pat: any) => pat.term),
      })),
    variations: [...(row.variations ?? [])].sort(byPosition).map((v: any) => ({
      id: v.id,
      sku: v.sku,
      price_cents: v.price_cents,
      sale_price_cents: v.sale_price_cents,
      in_stock: v.in_stock,
      position: v.position,
      terms: v.variation_terms ?? [],
    })),
  };
}

export function useProduct(slug: string | undefined) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      setError(error.message);
      setProduct(null);
    } else {
      setProduct(data ? normalise(data) : null);
    }
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  return { product, loading, error, reload: load };
}
