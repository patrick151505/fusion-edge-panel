import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Counts that aren't derivable from the loaded product list — fetched as cheap
 * head-only count queries in parallel. Product-derived stats (published, stock,
 * per-category, per-month…) are computed in the dashboard from useProducts.
 *
 * `users` is admin-gated by RLS: a non-admin simply gets 0, which is fine.
 */
export type DashboardStats = {
  variations: number;
  categories: number;
  brands: number;
  companies: number;
  users: number;
  savedItems: number;
};

const EMPTY: DashboardStats = {
  variations: 0,
  categories: 0,
  brands: 0,
  companies: 0,
  users: 0,
  savedItems: 0,
};

/** head:true + count:'exact' returns the count without transferring rows. */
async function countOf(table: string): Promise<number> {
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  return count ?? 0;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      // Tables added by later migrations may not exist yet; tolerate failures
      // per-table (Promise.allSettled) so the dashboard still renders.
      const [variations, categories, brands, companies, users, savedItems] =
        await Promise.allSettled([
          countOf("variations"),
          countOf("categories"),
          countOf("brands"),
          countOf("companies"),
          countOf("profiles"),
          countOf("saved_items"),
        ]);
      if (!active) return;

      const val = (r: PromiseSettledResult<number>) =>
        r.status === "fulfilled" ? r.value : 0;

      setStats({
        variations: val(variations),
        categories: val(categories),
        brands: val(brands),
        companies: val(companies),
        users: val(users),
        savedItems: val(savedItems),
      });
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  return { stats, loading };
}
