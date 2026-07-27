import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Product } from "../types/catalogue";

const SELECT = `
  id, name, slug, sku, kind, short_description,
  price_cents, sale_price_cents, price_max_cents,
  in_stock, featured, published, created_at,
  category:categories ( id, name, slug ),
  images:product_images ( id, url, alt, position, variation_id )
`;

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("products")
      .select(SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      setProducts([]);
    } else {
      // Position 0 is the main image; the rest are thumbnails.
      const rows = (data ?? []).map((p) => ({
        ...p,
        images: [...(p.images ?? [])].sort((a, b) => a.position - b.position),
      })) as unknown as Product[];
      setProducts(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { products, loading, error, reload: load };
}
