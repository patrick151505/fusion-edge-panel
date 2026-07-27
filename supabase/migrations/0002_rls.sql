-- Row-level security. The anon key ships in the browser bundle, so every rule
-- protecting user data has to live here in the database, not in React.
--
-- Shape of the rules:
--   catalog tables — world-readable when published, admin-writable
--   profiles       — own row only
--   saved_items    — strictly private to their owner

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
