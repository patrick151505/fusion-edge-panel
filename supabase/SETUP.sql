-- ===========================================================================
-- Fusion Edge — complete database setup
--
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- It creates the schema, the security rules, and one worked example product.
--
-- Contents:
--   1. Schema           tables, constraints, triggers
--   2. Security         row-level security policies
--   3. Example data     "Miro Dining Table" — Color x Size, 4 variations
--   4. Verification     two SELECTs so you can see the result
--
-- Safe to run on a NEW project. It is NOT safe to re-run as-is: step 1 will
-- error with "relation already exists". To start over, run the RESET block at
-- the bottom of this file first, then run this file again from the top.
-- ===========================================================================



-- ===========================================================================
-- 1. SCHEMA
-- ===========================================================================

create table categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index on categories (parent_id);

-- ---------------------------------------------------------------- attributes

-- Global attribute, e.g. Color, Size, Material.
create table attributes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- How the front end renders the choices on a product page.
  display_type text not null default 'select'
    check (display_type in ('select', 'button', 'color', 'image')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- A possible value of an attribute, e.g. Oak, Walnut, 180cm.
create table attribute_terms (
  id uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references attributes(id) on delete cascade,
  name text not null,
  slug text not null,
  -- Swatch payload for display_type 'color' (hex) or 'image' (url).
  swatch text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  -- Slugs are unique per attribute, not globally: Color/black and
  -- Finish/black can coexist.
  unique (attribute_id, slug)
);

create index on attribute_terms (attribute_id);

-- ------------------------------------------------------------------ products

create table products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  short_description text,
  sku text unique,

  kind text not null default 'simple' check (kind in ('simple', 'variable')),

  -- Money as integer cents: floats lose precision on arithmetic.
  -- For variable products these are derived from variations by trigger below
  -- and act as the "from / to" range shown on listing pages.
  price_cents integer check (price_cents >= 0),
  sale_price_cents integer check (sale_price_cents >= 0),
  price_max_cents integer check (price_max_cents >= 0),

  -- Availability without quantities: nothing is ever decremented here.
  in_stock boolean not null default true,

  featured boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A simple product must carry its own price. A variable product must not:
  -- its price columns are maintained from its variations.
  constraint simple_needs_price
    check (kind <> 'simple' or price_cents is not null),
  -- A sale price only makes sense below the regular price.
  constraint sale_below_price
    check (sale_price_cents is null
           or price_cents is null
           or sale_price_cents < price_cents)
);

create index on products (category_id);
create index on products (kind);
create index on products (published) where published;
create index on products (featured) where featured and published;

-- Which global attributes a product uses, and whether each one forms
-- variations (WooCommerce's "used for variations" checkbox).
create table product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  attribute_id uuid not null references attributes(id) on delete cascade,
  used_for_variations boolean not null default true,
  position integer not null default 0,
  unique (product_id, attribute_id)
);

create index on product_attributes (product_id);

-- The subset of a global attribute's terms this product offers. A table may
-- come in Oak and Walnut while the global Color attribute also knows Black.
create table product_attribute_terms (
  id uuid primary key default gen_random_uuid(),
  product_attribute_id uuid not null
    references product_attributes(id) on delete cascade,
  term_id uuid not null references attribute_terms(id) on delete cascade,
  position integer not null default 0,
  unique (product_attribute_id, term_id)
);

create index on product_attribute_terms (product_attribute_id);

-- ---------------------------------------------------------------- variations

-- One concrete purchasable combination, e.g. Oak / 180cm.
create table variations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  sku text unique,
  price_cents integer not null check (price_cents >= 0),
  sale_price_cents integer check (sale_price_cents >= 0),
  in_stock boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint variation_sale_below_price
    check (sale_price_cents is null or sale_price_cents < price_cents)
);

create index on variations (product_id);

-- The terms that define a variation: one row per attribute.
-- (Oak / 180cm is two rows: Color=Oak, Size=180cm.)
create table variation_terms (
  variation_id uuid not null references variations(id) on delete cascade,
  attribute_id uuid not null references attributes(id) on delete cascade,
  term_id uuid not null references attribute_terms(id) on delete cascade,
  -- One term per attribute per variation: a variation cannot be both Oak
  -- and Walnut.
  primary key (variation_id, attribute_id)
);

create index on variation_terms (term_id);

-- -------------------------------------------------------------------- images

-- Images belong to a product and may optionally be scoped to a variation, so
-- picking "Walnut" can swap the gallery. A null variation_id means the image
-- belongs to the product as a whole.
create table product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  variation_id uuid references variations(id) on delete cascade,
  url text not null,
  alt text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index on product_images (product_id, position);
create index on product_images (variation_id) where variation_id is not null;

-- ------------------------------------------------------------------ profiles

-- Mirrors auth.users; holds the app-facing fields auth.users shouldn't carry.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------- saved library

-- Replaces the cart. A user saves either a whole product or one specific
-- variation; both kinds live here side by side.
create table saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  -- Null means the product as a whole was saved.
  variation_id uuid references variations(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

create index on saved_items (user_id, created_at desc);
create index on saved_items (product_id);

-- Can't express "unique (user_id, product_id, variation_id)" directly because
-- NULL never equals NULL, so a product could be saved repeatedly. Two partial
-- unique indexes cover both cases.
create unique index saved_items_product_once
  on saved_items (user_id, product_id)
  where variation_id is null;

create unique index saved_items_variation_once
  on saved_items (user_id, variation_id)
  where variation_id is not null;

-- ------------------------------------------------------------------ triggers

-- Auto-create a profile row whenever someone signs up.
create function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch_updated_at
  before update on products
  for each row execute function touch_updated_at();

-- Keep a variable product's price range in sync with its variations, so
-- listing pages can sort and filter without joining every variation.
create function sync_variable_product_price()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  pid uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set price_cents = sub.min_price,
      price_max_cents = sub.max_price,
      in_stock = coalesce(sub.any_in_stock, false)
  from (
    select
      min(coalesce(sale_price_cents, price_cents)) as min_price,
      max(coalesce(sale_price_cents, price_cents)) as max_price,
      bool_or(in_stock) as any_in_stock
    from public.variations
    where product_id = pid
  ) sub
  where p.id = pid and p.kind = 'variable';

  return null;
end;
$$;

create trigger variations_sync_price
  after insert or update or delete on variations
  for each row execute function sync_variable_product_price();


-- ===========================================================================
-- 2. SECURITY (row-level security)
-- ===========================================================================

alter table categories              enable row level security;
alter table attributes              enable row level security;
alter table attribute_terms         enable row level security;
alter table products                enable row level security;
alter table product_attributes      enable row level security;
alter table product_attribute_terms enable row level security;
alter table variations              enable row level security;
alter table variation_terms         enable row level security;
alter table product_images          enable row level security;
alter table profiles                enable row level security;
alter table saved_items             enable row level security;

-- Admin check as a function so policies don't recursively query profiles.
create function is_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Is this product visible to the caller? Used by every child table so an
-- unpublished product hides its variations, images and attributes too.
create function product_visible(pid uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.products p
    where p.id = pid and (p.published or public.is_admin())
  );
$$;

-- ------------------------------------------------------------------- catalog

create policy "categories readable by anyone"
  on categories for select using (true);
create policy "categories writable by admins"
  on categories for all using (is_admin()) with check (is_admin());

create policy "attributes readable by anyone"
  on attributes for select using (true);
create policy "attributes writable by admins"
  on attributes for all using (is_admin()) with check (is_admin());

create policy "attribute terms readable by anyone"
  on attribute_terms for select using (true);
create policy "attribute terms writable by admins"
  on attribute_terms for all using (is_admin()) with check (is_admin());

create policy "published products readable by anyone"
  on products for select using (published or is_admin());
create policy "products writable by admins"
  on products for all using (is_admin()) with check (is_admin());

create policy "product attributes follow product"
  on product_attributes for select using (product_visible(product_id));
create policy "product attributes writable by admins"
  on product_attributes for all using (is_admin()) with check (is_admin());

create policy "product attribute terms follow product"
  on product_attribute_terms for select using (
    exists (
      select 1 from product_attributes pa
      where pa.id = product_attribute_terms.product_attribute_id
        and product_visible(pa.product_id)
    )
  );
create policy "product attribute terms writable by admins"
  on product_attribute_terms for all
  using (is_admin()) with check (is_admin());

create policy "variations follow product"
  on variations for select using (product_visible(product_id));
create policy "variations writable by admins"
  on variations for all using (is_admin()) with check (is_admin());

create policy "variation terms follow product"
  on variation_terms for select using (
    exists (
      select 1 from variations v
      where v.id = variation_terms.variation_id
        and product_visible(v.product_id)
    )
  );
create policy "variation terms writable by admins"
  on variation_terms for all using (is_admin()) with check (is_admin());

create policy "images follow product"
  on product_images for select using (product_visible(product_id));
create policy "images writable by admins"
  on product_images for all using (is_admin()) with check (is_admin());

-- ------------------------------------------------------------------ profiles

create policy "read own profile"
  on profiles for select using (id = auth.uid() or is_admin());
create policy "update own profile"
  on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- RLS grants access per row, never per column, so the policy above would
-- otherwise let any signed-in user set is_admin = true on their own row and
-- take over the catalog. Freeze the column at the trigger level instead:
-- privilege escalation has to go through SQL run by a project owner.
create function guard_profile_privileges()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and not public.is_admin() then
    raise exception 'is_admin cannot be changed by the account holder';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on profiles
  for each row execute function guard_profile_privileges();

-- --------------------------------------------------------------- saved items

-- Private to the owner. Admins are deliberately excluded: a user's library is
-- personal, and nothing in the app needs to read it on their behalf.
create policy "read own saved items"
  on saved_items for select using (user_id = auth.uid());

-- Saving is restricted to products the caller can actually see, so an
-- unpublished product can't be probed by trying to save it.
create policy "save own items"
  on saved_items for insert with check (
    user_id = auth.uid() and product_visible(product_id)
  );

create policy "update own saved items"
  on saved_items for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own saved items"
  on saved_items for delete using (user_id = auth.uid());


-- ===========================================================================
-- 3. EXAMPLE DATA
-- ===========================================================================

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


-- ===========================================================================
-- RESET — only if you need to start over.
--
-- Select the lines below, uncomment them, and run them ALONE. Then run this
-- file again from the top.
--
-- This permanently deletes all catalogue data and every saved library.
-- Accounts in auth.users are left untouched, but their profiles are removed.
-- ===========================================================================

-- drop trigger if exists on_auth_user_created on auth.users;
--
-- drop table if exists
--   saved_items, product_images, variation_terms, variations,
--   product_attribute_terms, product_attributes, products,
--   attribute_terms, attributes, categories, profiles
--   cascade;
--
-- drop function if exists
--   is_admin(), product_visible(uuid), handle_new_user(), touch_updated_at(),
--   sync_variable_product_price(), guard_profile_privileges()
--   cascade;
