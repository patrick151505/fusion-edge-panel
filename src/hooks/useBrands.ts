import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Brand } from "../types/catalogue";

/** Lightweight brand list for the product-form dropdown. */
export function useBrands() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("brands")
      .select("id, name, slug")
      .order("name")
      .then(({ data }) => {
        if (!active) return;
        setBrands((data as Brand[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { brands, loading };
}
