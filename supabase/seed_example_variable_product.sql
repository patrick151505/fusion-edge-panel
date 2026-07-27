-- Worked example: one variable product with two attributes (Color × Size).
--
--   Miro Dining Table
--     Color: Oak, Walnut     Size: 140cm, 180cm
--
--   Oak    / 140cm   $113.79   in stock    (has its own image)
--   Oak    / 180cm   $149.00   in stock
--   Walnut / 140cm   $131.50   OUT of stock
--   Walnut / 180cm   $167.50   in stock    (on sale at $149.99)
--
-- 2 colors × 2 sizes = 4 variations. You do not have to create every
-- combination — omit any that you don't sell.
--
-- Paste into the Supabase SQL Editor and run. Safe to re-run: it deletes the
-- product by slug first. Requires 0001_init.sql and 0002_rls.sql.

begin;

-- Re-runnable: variations, images and attribute links all cascade from here.
delete from products where slug = 'miro-dining-table';

-- ---------------------------------------------------------------------------
-- 1. Global attributes and their terms.
--    These are shared catalogue-wide, so `on conflict do nothing` keeps this
--    safe when other products already created them.
-- ---------------------------------------------------------------------------

insert into categories (name, slug) values ('Tables', 'tables')
on conflict (slug) do nothing;

insert into attributes (name, slug, display_type, position) values
  ('Color', 'color',  'color',  1),   -- 'color' renders swatches
  ('Size',  'size',   'button', 2)    -- 'button' renders pill buttons
on conflict (slug) do nothing;

insert into attribute_terms (attribute_id, name, slug, swatch, position)
select a.id, t.name, t.slug, t.swatch, t.position
from attributes a
join (values
  ('color', 'Oak',    'oak',    '#d2b48c', 1),
  ('color', 'Walnut', 'walnut', '#5c4033', 2)
) as t(attr, name, slug, swatch, position) on t.attr = a.slug
on conflict (attribute_id, slug) do nothing;

insert into attribute_terms (attribute_id, name, slug, position)
select a.id, t.name, t.slug, t.position
from attributes a
join (values
  ('size', '140cm', '140cm', 1),
  ('size', '180cm', '180cm', 2)
) as t(attr, name, slug, position) on t.attr = a.slug
on conflict (attribute_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2. The product.
--    kind = 'variable', and NO price: the trigger fills price_cents and
--    price_max_cents from the variations. Setting a price here would be
--    overwritten.
-- ---------------------------------------------------------------------------

insert into products (
  category_id, name, slug, kind, sku,
  short_description, description, featured, published
)
select
  c.id,
  'Miro Dining Table',
  'miro-dining-table',
  'variable',
  'MIRO-DT',
  'Solid oak dining table with tapered legs.',
  'A refined take on the classic dining table. Available in two finishes '
    || 'and two lengths, seating four to six.',
  true,
  true
from categories c
where c.slug = 'tables';

-- ---------------------------------------------------------------------------
-- 3. Declare which attributes this product uses.
--    used_for_variations = true means the attribute defines variations.
--    Set it false for spec-only attributes (e.g. "Material: Solid Oak") that
--    should display but not multiply into combinations.
-- ---------------------------------------------------------------------------

insert into product_attributes (product_id, attribute_id, used_for_variations, position)
select p.id, a.id, true, a.position
from products p
join attributes a on a.slug in ('color', 'size')
where p.slug = 'miro-dining-table';

-- Which terms this product actually offers. The global Color attribute may
-- know Black and White too; this table narrows it to Oak and Walnut.
insert into product_attribute_terms (product_attribute_id, term_id, position)
select pa.id, t.id, t.position
from product_attributes pa
join products p        on p.id = pa.product_id
join attribute_terms t on t.attribute_id = pa.attribute_id
where p.slug = 'miro-dining-table'
  and t.slug in ('oak', 'walnut', '140cm', '180cm');

-- ---------------------------------------------------------------------------
-- 4. The variations — one row per combination you sell.
--    Each carries its own price, sale price and stock flag.
-- ---------------------------------------------------------------------------

insert into variations (product_id, sku, price_cents, sale_price_cents, in_stock, position)
select p.id, v.sku, v.price, v.sale, v.stock, v.position
from products p
join (values
  ('MIRO-OAK-140', 11379, null,  true,  1),
  ('MIRO-OAK-180', 14900, null,  true,  2),
  ('MIRO-WAL-140', 13150, null,  false, 3),   -- out of stock
  ('MIRO-WAL-180', 16750, 14999, true,  4)    -- on sale
) as v(sku, price, sale, stock, position) on true
where p.slug = 'miro-dining-table';

-- ---------------------------------------------------------------------------
-- 5. Link each variation to its terms — TWO rows per variation, one per
--    attribute. This is the step that actually makes it "Oak / 140cm".
--    Matching is by SKU suffix so the mapping stays readable.
-- ---------------------------------------------------------------------------

insert into variation_terms (variation_id, attribute_id, term_id)
select v.id, t.attribute_id, t.id
from variations v
join products p on p.id = v.product_id
join attribute_terms t on (
  (v.sku like '%-OAK-%' and t.slug = 'oak')    or
  (v.sku like '%-WAL-%' and t.slug = 'walnut') or
  (v.sku like '%-140'   and t.slug = '140cm')  or
  (v.sku like '%-180'   and t.slug = '180cm')
)
where p.slug = 'miro-dining-table';

-- ---------------------------------------------------------------------------
-- 6. Images.
--    variation_id NULL  → product-level, shown by default
--    variation_id SET   → swapped in when that variation is selected
--
--    `url` is used verbatim as an <img src>, so an absolute URL
--    ('https://…/chair.jpg') works as-is. The relative paths below expect
--    files in this project's public/ folder and will render a placeholder
--    until those exist — replace them with real URLs.
-- ---------------------------------------------------------------------------

insert into product_images (product_id, variation_id, url, alt, position)
select p.id, null, '/products/miro-main.jpg', 'Miro Dining Table', 0
from products p where p.slug = 'miro-dining-table';

insert into product_images (product_id, variation_id, url, alt, position)
select p.id, v.id, '/products/miro-oak.jpg', 'Miro Dining Table in oak', 1
from products p
join variations v on v.product_id = p.id and v.sku = 'MIRO-OAK-140'
where p.slug = 'miro-dining-table';

insert into product_images (product_id, variation_id, url, alt, position)
select p.id, v.id, '/products/miro-walnut.jpg', 'Miro Dining Table in walnut', 2
from products p
join variations v on v.product_id = p.id and v.sku = 'MIRO-WAL-180'
where p.slug = 'miro-dining-table';

commit;

-- ---------------------------------------------------------------------------
-- Check the result. The product's price range is maintained by the trigger:
-- expect 11379 (Oak/140) .. 16750 (Walnut/180).
-- ---------------------------------------------------------------------------

select
  p.name,
  p.kind,
  p.price_cents     as range_from_cents,
  p.price_max_cents as range_to_cents,
  p.in_stock
from products p
where p.slug = 'miro-dining-table';

-- One row per variation with its terms collapsed into a label.
select
  v.sku,
  string_agg(t.name, ' / ' order by a.position) as combination,
  v.price_cents,
  v.sale_price_cents,
  v.in_stock,
  (select count(*) from product_images i where i.variation_id = v.id) as images
from variations v
join products p        on p.id = v.product_id
join variation_terms vt on vt.variation_id = v.id
join attributes a       on a.id = vt.attribute_id
join attribute_terms t  on t.id = vt.term_id
where p.slug = 'miro-dining-table'
group by v.id, v.sku, v.price_cents, v.sale_price_cents, v.in_stock, v.position
order by v.position;
