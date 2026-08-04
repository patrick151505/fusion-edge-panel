import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Brand, Company } from "../types/catalogue";

/**
 * Companies, all brands, and which brands belong to each company — everything
 * the product form needs to show a Company picker that filters the Brand list.
 */
export function useCompanyBrands() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  /** company id -> the brands assigned to it. */
  const [brandsByCompany, setBrandsByCompany] = useState<
    Map<string, Brand[]>
  >(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const [companyRes, brandRes, linkRes] = await Promise.all([
        supabase.from("companies").select("id, name, slug").order("name"),
        supabase.from("brands").select("id, name, slug").order("name"),
        supabase.from("brand_companies").select("brand_id, company_id"),
      ]);
      if (!active) return;

      const companyList = (companyRes.data as Company[]) ?? [];
      const brandList = (brandRes.data as Brand[]) ?? [];
      const brandById = new Map(brandList.map((b) => [b.id, b]));

      const map = new Map<string, Brand[]>();
      for (const l of linkRes.data ?? []) {
        const cid = (l as { company_id: string }).company_id;
        const bid = (l as { brand_id: string }).brand_id;
        const brand = brandById.get(bid);
        if (!brand) continue;
        const arr = map.get(cid) ?? [];
        arr.push(brand);
        map.set(cid, arr);
      }

      setCompanies(companyList);
      setBrands(brandList);
      setBrandsByCompany(map);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return { companies, brands, brandsByCompany, loading };
}
