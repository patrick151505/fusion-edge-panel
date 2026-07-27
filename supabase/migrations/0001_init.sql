-- Fusion Edge catalog schema.
--
-- A product catalogue with saved-items ("library"), not a store: no cart, no
-- orders, no checkout. Prices are displayed for reference only.
--
-- Product model follows WooCommerce:
--   simple   — one price, one image set, no attributes
--   variable — attributes (Color, Size) whose combinations are variations,
--              each with its own price, stock flag, and images
--
-- Attributes are global and reusable: "Color" and its term "Oak" are defined
-- once and shared by every product, so sitewide filtering works.

-- ---------------------------------------------------------------- categories

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
