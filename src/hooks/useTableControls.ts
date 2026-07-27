import { useEffect, useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

type Options<T> = {
  rows: T[];
  /** Fields searched by the query box. */
  searchFields: (row: T) => (string | null | undefined)[];
  /** Sort comparators, keyed by the sort option value. */
  sorters: Record<string, (a: T, b: T) => number>;
  initialSort: string;
  pageSize?: number;
};

/**
 * Client-side search + sort + pagination shared by the admin list pages.
 *
 * The catalogue tables are small enough to filter in the browser; this keeps
 * one round trip and makes the controls instant.
 */
export function useTableControls<T>({
  rows,
  searchFields,
  sorters,
  initialSort,
  pageSize = 10,
}: Options<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(initialSort);
  const [dir, setDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      searchFields(r).some((f) => (f ?? "").toLowerCase().includes(q))
    );
    // searchFields is a fresh closure each render; rows+query drive the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query]);

  const sorted = useMemo(() => {
    const cmp = sorters[sortKey];
    if (!cmp) return filtered;
    const out = [...filtered].sort(cmp);
    return dir === "asc" ? out : out.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sortKey, dir]);

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Keep the page in range when filtering shrinks the result set.
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const paged = useMemo(
    () => sorted.slice((page - 1) * pageSize, page * pageSize),
    [sorted, page, pageSize]
  );

  return {
    query,
    setQuery: (v: string) => {
      setQuery(v);
      setPage(1);
    },
    sortKey,
    setSortKey: (v: string) => {
      setSortKey(v);
      setPage(1);
    },
    dir,
    toggleDir: () => setDir((d) => (d === "asc" ? "desc" : "asc")),
    page,
    setPage,
    pageCount,
    total,
    rows: paged,
    rangeStart: total === 0 ? 0 : (page - 1) * pageSize + 1,
    rangeEnd: Math.min(page * pageSize, total),
  };
}
