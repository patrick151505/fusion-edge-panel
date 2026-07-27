-- ============================================================================
-- Product-owned attribute values — run ONCE in the Supabase SQL Editor.
--
-- Values added from the Attributes page stay global (product_id IS NULL) and
-- appear in every product's picker. Values added from inside a product get
-- that product's id, so they are private to it and never pollute the shared
-- pool — WooCommerce's global-vs-custom split.
--
-- Re-running is safe.
-- ============================================================================

-- 1. Ownership column. Null = global (the existing behaviour, unchanged).
alter table attribute_terms
  add column if not exists product_id uuid
    references products(id) on delete cascade;

comment on column attribute_terms.product_id is
  'Owning product for a private value; NULL means a shared/global value.';

-- 2. The existing unique(attribute_id, slug) would stop two products each
--    having a private "large". Replace it with two partial uniques:
--    globals stay unique per attribute; private values unique per product.
alter table attribute_terms
  drop constraint if exists attribute_terms_attribute_id_slug_key;

create unique index if not exists attribute_terms_global_slug
  on attribute_terms (attribute_id, slug)
  where product_id is null;

create unique index if not exists attribute_terms_product_slug
  on attribute_terms (attribute_id, product_id, slug)
  where product_id is not null;

-- 3. Helpful index for the "this product's values" lookups.
create index if not exists attribute_terms_product_id
  on attribute_terms (product_id);
