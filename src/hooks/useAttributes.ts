import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { AttributeWithTerms } from "../types/catalogue";

const SELECT = `
  id, name, slug, display_type, position,
  terms:attribute_terms ( id, name, slug, swatch, position )
`;

const byPos = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

/** The reusable global attribute pool (Color, Size…) with all their terms. */
export function useAttributes() {
  const [attributes, setAttributes] = useState<AttributeWithTerms[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("attributes")
      .select(SELECT)
      .order("position");

    const rows = (data ?? []).map((a) => ({
      ...a,
      terms: [...((a as AttributeWithTerms).terms ?? [])].sort(byPos),
    })) as AttributeWithTerms[];

    setAttributes(rows.sort(byPos));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { attributes, loading, reload: load };
}
