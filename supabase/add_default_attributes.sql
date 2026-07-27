-- ============================================================================
-- Default variation options — run ONCE in the Supabase SQL Editor.
--
-- WooCommerce lets a variable product preselect one term per attribute, so the
-- product page opens with a variation already chosen instead of an empty
-- picker. This adds the column that stores that choice.
--
-- default_term_id is nullable: "no default" is the normal state, and the
-- picker simply starts empty as it does today.
--
-- ON DELETE SET NULL matters — deleting a term (e.g. retiring "Oak") must not
-- delete the product's attribute link, just clear the default.
-- Re-running is safe.
-- ============================================================================

alter table product_attributes
  add column if not exists default_term_id uuid
    references attribute_terms(id) on delete set null;

comment on column product_attributes.default_term_id is
  'Term preselected on the product page. Null means no default.';
