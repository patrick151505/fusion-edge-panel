import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Category } from "../types/catalogue";

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("categories")
      .select("id, name, slug")
      .order("name")
      .then(({ data }) => {
        if (!active) return;
        setCategories((data as Category[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { categories, loading };
}
