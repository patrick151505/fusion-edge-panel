-- ===========================================================================
-- ADD A SIMPLE PRODUCT WITH SPEC ATTRIBUTES
--
-- One price, one image set, no options to choose — but a rich spec list:
-- Material, Finish, Dimensions, Weight, Origin, Warranty…
--
-- The difference from a variable product is one flag:
--
--   used_for_variations = true   the attribute creates variations the
--                                shopper picks between (Color, Size)
--   used_for_variations = false  the attribute is descriptive only; it
--                                displays as a spec and creates nothing
--
-- So a product can carry any number of attributes and still be `simple`,
-- with a single price and no pickers. That is what this file builds.
--
-- Copy it, edit the CONFIG block, run it. Re-runnable.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. CONFIG — edit only this block.
-- ---------------------------------------------------------------------------

create temp table cfg on commit drop as
select
  'Sled Mini Sideboard'::text  as name,
  'sled-mini-sideboard'::text  as slug,
  'storage'::text              as category_slug,
  'SLED-MINI'::text            as sku,
  16558                        as price_cents,      -- $165.58
  null::integer                as sale_price_cents, -- or e.g. 14900
  true                         as in_stock,
  false                        as featured,
  true                         as published,
  'Compact sideboard with a powder-coated steel frame.'::text
                               as short_description,
  'Two soft-close doors over an open shelf. The powder-coated frame keeps '
  || 'the profile light while solid oak veneer gives the top its warmth.'::text
                               as description;

-- Descriptive attributes. These render as a spec list — no pickers, no
-- variations, no effect on price.
--
--   attribute  the spec name, e.g. Material
--   value      the spec value, e.g. Solid Oak
--   swatch     optional colour hex; shows a dot beside the value
--
-- Add or remove rows freely. Attributes are global, so reusing the same
-- attribute name across products keeps the catalogue consistent.
create temp table cfg_specs on commit drop as
select * from (values
  ('Material',   'material',   'Solid Oak Veneer',        null),
  ('Frame',      'frame',      'Powder-Coated Steel',     null),
  ('Finish',     'finish',     'Matte Charcoal',          '#3a3a3c'),
  ('Dimensions', 'dimensions', '90cm W x 40cm D x 55cm H', null),
  ('Weight',     'weight',     '24 kg',                   null),
  ('Origin',     'origin',     'Made in Portugal',        null),
  ('Warranty',   'warranty',   '5 Years',                 null)
) as t(attr_name, attr_slug, value, swatch);

-- Gallery. First row is the default shown on listing tiles.
create temp table cfg_images on commit drop as
select * from (values
  ('https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800', 'Sled Mini Sideboard', 0),
  ('https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800', 'Sideboard, side view', 1)
) as t(url, alt, position);

-- ---------------------------------------------------------------------------
-- 2. Nothing below here needs editing.
-- ---------------------------------------------------------------------------

delete from products where slug = (select slug from cfg);

insert into categories (name, slug)
select initcap(replace(category_slug, '-', ' ')), category_slug from cfg
on conflict (slug) do nothing;

-- kind = 'simple', so price_cents lives on the product itself. (A variable
-- product must leave it null — the trigger fills it from variations.)
insert into products (
  category_id, name, slug, kind, sku, price_cents, sale_price_cents,
  short_description, description, in_stock, featured, published
)
select c.id, cfg.name, cfg.slug, 'simple', cfg.sku,
       cfg.price_cents, cfg.sale_price_cents,
       cfg.short_description, cfg.description,
       cfg.in_stock, cfg.featured, cfg.published
from cfg join categories c on c.slug = cfg.category_slug;

-- Each spec becomes a global attribute. display_type 'select' is a sensible
-- default; it is never rendered as a picker because the attribute is not
-- used for variations.
insert into attributes (name, slug, display_type, position)
select s.attr_name, s.attr_slug,
       case when s.swatch is not null then 'color' else 'select' end,
       100 + row_number() over ()   -- after Color/Size in the picker order
from cfg_specs s
on conflict (slug) do nothing;

-- The spec's value becomes a term of that attribute.
insert into attribute_terms (attribute_id, name, slug, swatch, position)
select a.id, s.value,
       -- Slug from the value: lowercase, non-alphanumerics to hyphens.
       trim(both '-' from regexp_replace(lower(s.value), '[^a-z0-9]+', '-', 'g')),
       s.swatch,
       1
from cfg_specs s
join attributes a on a.slug = s.attr_slug
on conflict (attribute_id, slug) do nothing;

-- THE KEY LINE: used_for_variations = false.
-- The attribute is attached to the product for display, but creates no
-- variations and no picker.
insert into product_attributes (product_id, attribute_id, used_for_variations, position)
select p.id, a.id, false, a.position
from products p, cfg
join cfg_specs s on true
join attributes a on a.slug = s.attr_slug
where p.slug = cfg.slug;

-- Attach the single value each spec has.
insert into product_attribute_terms (product_attribute_id, term_id, position)
select pa.id, t.id, 1
from product_attributes pa
join products p on p.id = pa.product_id
join cfg on p.slug = cfg.slug
join cfg_specs s on true
join attributes a on a.id = pa.attribute_id and a.slug = s.attr_slug
join attribute_terms t
  on t.attribute_id = a.id
 and t.slug = trim(both '-' from regexp_replace(lower(s.value), '[^a-z0-9]+', '-', 'g'));

-- Images are product-level (variation_id null) — there are no variations.
insert into product_images (product_id, variation_id, url, alt, position)
select p.id, null, i.url, i.alt, i.position
from cfg_images i, products p, cfg
where p.slug = cfg.slug;

commit;

-- ---------------------------------------------------------------------------
-- Result.
-- ---------------------------------------------------------------------------

select name, kind, price_cents, sale_price_cents, in_stock, published
from products where slug = 'sled-mini-sideboard';

-- The spec list as the product page will show it.
select
  a.name  as spec,
  t.name  as value,
  t.swatch,
  pa.used_for_variations
from product_attributes pa
join products p        on p.id = pa.product_id
join attributes a      on a.id = pa.attribute_id
join product_attribute_terms pat on pat.product_attribute_id = pa.id
join attribute_terms t on t.id = pat.term_id
where p.slug = 'sled-mini-sideboard'
order by a.position;

-- Should be zero: a simple product has no variations.
select count(*) as variation_count
from variations v join products p on p.id = v.product_id
where p.slug = 'sled-mini-sideboard';
