-- Point product images at full URLs.
--
-- product_images.url is used verbatim as an <img src>, so it accepts either
-- form:
--   https://example.com/chair.jpg   any absolute URL
--   /products/chair.jpg             a file in this project's public/ folder
--
-- Absolute URLs need no setup, which makes them the quickest way to get real
-- photography on screen. Two caveats worth knowing:
--   * the host must allow hotlinking, and may rate-limit or block it later
--   * Google Shopping / gstatic thumbnails are cache URLs, not stable assets;
--     they expire without warning
-- For anything permanent, upload to Supabase Storage and use its public URL.

begin;

-- ---------------------------------------------------------------------------
-- 1. The product-level image.
--    variation_id IS NULL means "shown by default" — on listing tiles, the
--    hero, and the product page before any option is chosen. Without one, the
--    catalogue renders a placeholder no matter how many variation images exist.
-- ---------------------------------------------------------------------------

update product_images i
set url = 'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSxQffl2_622jJAlYnuPYGocwGNCqCrwd3h2EGGdwRwevhg2pdnpmICSY4_CIJIIx9Ud-B9Xk2tDu1gp01_JmPlRR_BbaPhLHnnMkblHBOQXj3Fahl-xTe0uw',
    alt = 'Miro Dining Table'
from products p
where p.id = i.product_id
  and p.slug = 'miro-dining-table'
  and i.variation_id is null;

-- ---------------------------------------------------------------------------
-- 2. Variation-specific images, matched by SKU.
--    These replace the gallery when that variation is selected. Swap in your
--    own URLs; a variation with no image falls back to the product image.
-- ---------------------------------------------------------------------------

update product_images i
set url = v.new_url, alt = v.new_alt
from variations var
join (values
  ('MIRO-OAK-140',
   'https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcSxQffl2_622jJAlYnuPYGocwGNCqCrwd3h2EGGdwRwevhg2pdnpmICSY4_CIJIIx9Ud-B9Xk2tDu1gp01_JmPlRR_BbaPhLHnnMkblHBOQXj3Fahl-xTe0uw',
   'Miro Dining Table in oak, 140cm')
) as v(sku, new_url, new_alt) on v.sku = var.sku
where i.variation_id = var.id;

commit;

-- ---------------------------------------------------------------------------
-- Check what the catalogue will render.
-- `scope` shows which images act as defaults vs. per-variation swaps.
-- ---------------------------------------------------------------------------

select
  p.name,
  coalesce(v.sku, '(product default)') as scope,
  left(i.url, 60) || case when length(i.url) > 60 then '…' else '' end as url,
  i.position
from product_images i
join products p on p.id = i.product_id
left join variations v on v.id = i.variation_id
where p.slug = 'miro-dining-table'
order by i.variation_id nulls first, i.position;
