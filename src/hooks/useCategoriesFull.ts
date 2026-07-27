import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { CategoryFull } from "../types/catalogue";

/**
 * Categories with their management fields and a product count.
 *
 * The count comes from a single grouped fetch of product category ids rather
 * than one count query per row.
 */
export function useCategoriesFull() {
  const [categories, setCategories] = useState<CategoryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, description, image_url, position")
      .order("position")
      .order("name");

    if (error) {
      setError(error.message);
      setCategories([]);
      setLoading(false);
      return;
    }

    const { data: prods } = await supabase
      .from("products")
      .select("category_id");

    const counts = new Map<string, number>();
    for (const p of prods ?? []) {
      const id = (p as { category_id: string | null }).category_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }

    setCategories(
      (data as CategoryFull[]).map((c) => ({
        ...c,
        product_count: counts.get(c.id) ?? 0,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { categories, loading, error, reload: load };
}
