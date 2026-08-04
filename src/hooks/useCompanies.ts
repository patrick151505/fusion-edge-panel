import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Company } from "../types/catalogue";

/** Lightweight company list for the brand-form dropdown. */
export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("companies")
      .select("id, name, slug")
      .order("name")
      .then(({ data }) => {
        if (!active) return;
        setCompanies((data as Company[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { companies, loading };
}
