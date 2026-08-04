import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { CompanyFull } from "../types/catalogue";

/**
 * Companies with their management fields and a brand count.
 *
 * The count comes from a single grouped fetch of brand company ids rather than
 * one count query per row.
 */
export function useCompaniesFull() {
  const [companies, setCompanies] = useState<CompanyFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug, description, logo_url, position")
      .order("position")
      .order("name");

    if (error) {
      setError(error.message);
      setCompanies([]);
      setLoading(false);
      return;
    }

    // Which brands each company has, from the many-to-many join table.
    const { data: links } = await supabase
      .from("brand_companies")
      .select("company_id, brand_id");

    const brandIdsByCompany = new Map<string, string[]>();
    for (const l of links ?? []) {
      const cid = (l as { company_id: string }).company_id;
      const bid = (l as { brand_id: string }).brand_id;
      const arr = brandIdsByCompany.get(cid) ?? [];
      arr.push(bid);
      brandIdsByCompany.set(cid, arr);
    }

    setCompanies(
      (data as CompanyFull[]).map((c) => {
        const brand_ids = brandIdsByCompany.get(c.id) ?? [];
        return { ...c, brand_ids, brand_count: brand_ids.length };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { companies, loading, error, reload: load };
}
