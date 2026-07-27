-- Add extra gallery images to an existing product.
--
-- variation_id null  → product-level; these form the default gallery
-- variation_id set   → replaces the gallery when that variation is selected
--
-- `position` orders them: 0 is the main image, the rest become thumbnails.
-- A product with a single image shows no thumbnail row.

insert into product_images (product_id, variation_id, url, alt, position)
select p.id, null, i.url, i.alt, i.position
from products p
join (values
  ('https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=800',
   'Miro Dining Table, angled view', 1),
  ('https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800',
   'Miro Dining Table, detail of the leg joint', 2)
) as i(url, alt, position) on true
where p.slug = 'miro-dining-table';

-- What the gallery will show, in order.
select
  coalesce(v.sku, '(product default)') as scope,
  i.position,
  left(i.url, 55) || '…' as url,
  i.alt
from product_images i
join products p on p.id = i.product_id
left join variations v on v.id = i.variation_id
where p.slug = 'miro-dining-table'
order by i.variation_id nulls first, i.position;
