-- ===========================================================================
-- ADD A PRODUCT — copy this file, edit the CONFIG block, run it.
--
-- Everything you change lives in step 1. The rest resolves ids by slug and
-- needs no editing.
--
-- Re-runnable: deletes the product by slug first, so fixing a typo is just an
-- edit and another Run.
--
-- For a SIMPLE product (one price, no options) see the second half of this
-- file — scroll to "SIMPLE PRODUCT".
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. CONFIG — edit only this block.
-- ---------------------------------------------------------------------------

create temp table cfg on commit drop as
select
  'Shell Chair'::text          as name,
  'shell-chair'::text          as slug,          -- URL: /product/shell-chair
  'chairs'::text               as category_slug, -- created if missing
  'SHELL'::text                as sku_prefix,
  'Moulded plywood chair with a sculpted seat.'::text as short_description,
  'A modern classic. Steam-bent plywood shell on solid legs, finished by hand.'::text
                               as description,
  true                         as featured,      -- show in the hero carousel
  true                         as published,     -- false = hidden from the site
  -- Default image, shown on listing tiles and before any option is picked.
  'https://images.unsplash.com/photo-1503602642458-232111445657?w=800'::text
                               as image_url;

-- The colours this product comes in.
--   swatch = the dot shown in the picker
--   image  = optional; replaces the gallery when that colour is chosen
create temp table cfg_colors on commit drop as
select * from (values
  ('Oak',    'oak',    '#d2b48c', 'https://images.unsplash.com/photo-1503602642458-232111445657?w=800'),
  ('Walnut', 'walnut', '#5c4033', 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800'),
  ('Black',  'black',  '#2b2b2b', null)
) as t(name, slug, swatch, image_url);

-- The sizes it comes in. Use ('One Size','one-size') if size doesn't apply.
create temp table cfg_sizes on commit drop as
select * from (values
  ('Small',  'small'),
  ('Medium', 'medium'),
  ('Large',  'large')
) as t(name, slug);

-- Price and stock for each combination, in cents.
--   Every colour × size pair you want to sell needs a row here.
--   Omit a pair to not offer it. Set sale_cents to null for no discount.
create temp table cfg_variations on commit drop as
select * from (values
  --  colour     size       price   sale    in stock
  ('oak',    'small',   9900,   null,   true),
  ('oak',    'medium',  11900,  null,   true),
  ('oak',    'large',   13900,  null,   true),
  ('walnut', 'small',   10900,  9900,   true),   -- on sale
  ('walnut', 'medium',  12900,  null,   true),
  ('walnut', 'large',   14900,  null,   false),  -- out of stock
  ('black',  'medium',  11900,  null,   true)    -- black: medium only
) as t(color_slug, size_slug, price_cents, sale_cents, in_stock);

-- ---------------------------------------------------------------------------
-- 2. Nothing below here needs editing.
-- ---------------------------------------------------------------------------

delete from products where slug = (select slug from cfg);

insert into categories (name, slug)
select initcap(replace(category_slug, '-', ' ')), category_slug from cfg
on conflict (slug) do nothing;

-- Global attributes, shared across the whole catalogue.
insert into attributes (name, slug, display_type, position) values
  ('Color', 'color',  'color',  1),
  ('Size',  'size',   'button', 2)
on conflict (slug) do nothing;

insert into attribute_terms (attribute_id, name, slug, swatch, position)
select a.id, c.name, c.slug, c.swatch, row_number() over ()
from cfg_colors c cross join attributes a
where a.slug = 'color'
on conflict (attribute_id, slug) do nothing;

insert into attribute_terms (attribute_id, name, slug, position)
select a.id, s.name, s.slug, row_number() over ()
from cfg_sizes s cross join attributes a
where a.slug = 'size'
on conflict (attribute_id, slug) do nothing;

-- The product. No price: the trigger derives the range from variations.
insert into products (
  category_id, name, slug, kind, sku,
  short_description, description, featured, published
)
select cat.id, cfg.name, cfg.slug, 'variable', cfg.sku_prefix,
       cfg.short_description, cfg.description, cfg.featured, cfg.published
from cfg join categories cat on cat.slug = cfg.category_slug;

-- Which attributes this product uses.
insert into product_attributes (product_id, attribute_id, used_for_variations, position)
select p.id, a.id, true, a.position
from products p, cfg, attributes a
where p.slug = cfg.slug and a.slug in ('color', 'size');

-- Narrow each attribute to the terms this product actually offers.
insert into product_attribute_terms (product_attribute_id, term_id, position)
select pa.id, t.id, t.position
from product_attributes pa
join products p on p.id = pa.product_id
join cfg on p.slug = cfg.slug
join attribute_terms t on t.attribute_id = pa.attribute_id
where (t.attribute_id = (select id from attributes where slug = 'color')
        and t.slug in (select slug from cfg_colors))
   or (t.attribute_id = (select id from attributes where slug = 'size')
        and t.slug in (select slug from cfg_sizes));

-- One variation per configured combination. SKU is built from the prefix.
insert into variations (product_id, sku, price_cents, sale_price_cents, in_stock, position)
select
  p.id,
  cfg.sku_prefix || '-' || upper(v.color_slug) || '-' || upper(v.size_slug),
  v.price_cents, v.sale_cents, v.in_stock,
  row_number() over ()
from cfg_variations v, products p, cfg
where p.slug = cfg.slug;

-- Link each variation to its colour and size — two rows per variation.
insert into variation_terms (variation_id, attribute_id, term_id)
select var.id, t.attribute_id, t.id
from variations var
join products p on p.id = var.product_id
join cfg on p.slug = cfg.slug
join cfg_variations v
  on var.sku = cfg.sku_prefix || '-' || upper(v.color_slug) || '-' || upper(v.size_slug)
join attribute_terms t
  on (t.slug = v.color_slug
        and t.attribute_id = (select id from attributes where slug = 'color'))
  or (t.slug = v.size_slug
        and t.attribute_id = (select id from attributes where slug = 'size'));

-- Default image (variation_id null = shown by default).
insert into product_images (product_id, variation_id, url, alt, position)
select p.id, null, cfg.image_url, cfg.name, 0
from products p join cfg on p.slug = cfg.slug
where cfg.image_url is not null;

-- Per-colour images, attached to every variation of that colour so the
-- gallery swaps whichever size is selected.
insert into product_images (product_id, variation_id, url, alt, position)
select p.id, var.id, c.image_url, cfg.name || ' in ' || c.name, 1
from cfg_colors c
join products p on true
join cfg on p.slug = cfg.slug
join variations var on var.product_id = p.id
join variation_terms vt on vt.variation_id = var.id
join attribute_terms t
  on t.id = vt.term_id
 and t.slug = c.slug
 and t.attribute_id = (select id from attributes where slug = 'color')
where c.image_url is not null;

commit;

-- ---------------------------------------------------------------------------
-- Result. Price range is maintained by the trigger.
-- ---------------------------------------------------------------------------

select name, kind, price_cents as from_cents, price_max_cents as to_cents,
       in_stock, published
from products where slug = 'shell-chair';

select
  v.sku,
  string_agg(t.name, ' / ' order by a.position) as combination,
  v.price_cents, v.sale_price_cents, v.in_stock,
  (select count(*) from product_images i where i.variation_id = v.id) as images
from variations v
join products p on p.id = v.product_id
join variation_terms vt on vt.variation_id = v.id
join attributes a on a.id = vt.attribute_id
join attribute_terms t on t.id = vt.term_id
where p.slug = 'shell-chair'
group by v.id, v.sku, v.price_cents, v.sale_price_cents, v.in_stock, v.position
order by v.position;


-- ===========================================================================
-- SIMPLE PRODUCT — no options, one price. Much shorter.
-- ===========================================================================

-- begin;
--
-- delete from products where slug = 'teapot';
--
-- insert into categories (name, slug) values ('Accessories', 'accessories')
-- on conflict (slug) do nothing;
--
-- insert into products (
--   category_id, name, slug, kind, sku, price_cents, sale_price_cents,
--   short_description, description, in_stock, featured, published
-- )
-- select c.id, 'Teapot', 'teapot', 'simple', 'TEAPOT-01',
--        12005,           -- $120.05
--        null,            -- sale price, or null
--        'Cast iron teapot with a bamboo handle.',
--        'Holds 800ml. Enamelled interior, suitable for loose leaf.',
--        true, false, true
-- from categories c where c.slug = 'accessories';
--
-- insert into product_images (product_id, variation_id, url, alt, position)
-- select p.id, null,
--        'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800',
--        'Teapot', 0
-- from products p where p.slug = 'teapot';
--
-- commit;
--
-- select name, kind, price_cents, in_stock, published
-- from products where slug = 'teapot';
