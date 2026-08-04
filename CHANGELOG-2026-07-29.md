# Changelog — 2026-07-29

Work completed today, grouped for ClickUp. Each item notes whether it needs a
**DB migration** or **deploy** action.

---

## 1. Fixed: attribute values leaking into other products
- On the **New Product** page, adding an attribute value no longer writes it to
  the global pool. Values are held locally and saved as **product-owned**
  (private) only when the product is created.
- Confirmed model: values added on the **Attributes admin page** = global;
  values added on a **product** = that product only.
- Files: `src/components/product/AttributeBuilder.tsx`, `src/pages/ProductNew.tsx`
- ✅ No migration needed.

## 2. Cleanup queries for stray / junk attribute data
- SQL to find global values that leaked, plus junk `data-cim-*` / `data-*`
  attributes scraped from WordPress markup.
- ⚠️ **Open item:** deletion is paused pending a blast-radius check
  (`cim_junk_blast_radius.sql`) — must confirm no real variations depend on
  those attributes before deleting.
- Files: `supabase/find_stray_global_terms.sql`, `supabase/inspect_cim_junk.sql`,
  `supabase/cim_junk_blast_radius.sql`

## 3. Attributes admin page — edit image values
- Value editor is now type-aware: **color** → color picker; **image** →
  thumbnail preview + URL field + **Choose** (media library); validates image
  URLs on save.
- File: `src/pages/Attributes.tsx`
- ✅ No migration needed.

## 4. Product page — edit values (product-owned only)
- Edit pencil on value chips to change name / color / image, **only for values
  owned by that product** (global values stay read-only to protect other
  products).
- Files: `src/components/product/AttributeBuilder.tsx`,
  `src/pages/ProductNew.tsx`, `src/types/catalogue.ts`
- ✅ No migration needed.

## 5. User management (view / invite / create / edit / delete / ban / roles)
- **Roles:** new `admin` / `staff` / `customer` enum on `profiles`; `is_admin`
  auto-synced so existing security still works.
- **Users page:** list with email, search/sort/pagination, inline role change,
  ban/reactivate, delete, edit name, and Add-user modal (Invite or Create).
  Admin-only, wired into sidebar + router.
- **Edge Function** (`admin-users`) for privileged actions using the
  service-role key, with admin verification and self-sabotage protection.
- Files: `supabase/migrations/0003_user_roles.sql`,
  `supabase/functions/admin-users/index.ts`,
  `supabase/functions/admin-users/DEPLOY.md`, `src/pages/Users.tsx`,
  `src/hooks/useUsers.ts`, `src/lib/users.ts`, `src/App.tsx`,
  `src/layout/AppSidebar.tsx`
- ⚠️ **Action required:** (a) run `0003_user_roles.sql`; (b) deploy the Edge
  Function + set `SERVICE_ROLE_KEY`.

## 6. Fixed: "permission denied for table users" on Users page
- The `admin_users` view ran with caller rights and couldn't read `auth.users`.
  Recreated it with owner rights (the `is_admin()` filter still limits rows to
  admins).
- Files: `supabase/migrations/0004_fix_admin_users_view.sql` (+ corrected
  `0003`)
- ⚠️ **Action required:** run `0004_fix_admin_users_view.sql`.

---

## 7. Brands (new — every product now has a brand)
- New **Brands** page under Product (sidebar + `/product/brands`): name, slug,
  description, logo (photo via media picker), search/sort/pager — mirrors
  Categories.
- Brand is **required** on products; a **Brand** dropdown was added to the
  New and Edit product forms with validation.
- Migration seeds a **"Generic"** brand and backfills all existing products to
  it, so the required rule holds without breaking anything.
- `useProduct` falls back gracefully if the migration hasn't run yet (brand-free
  query) so product pages never break pre-migration.
- Files: `supabase/migrations/0005_brands.sql`, `src/pages/Brands.tsx`,
  `src/lib/brands.ts`, `src/hooks/useBrands.ts`, `src/hooks/useBrandsFull.ts`,
  `src/hooks/useProduct.ts`, `src/pages/ProductNew.tsx`,
  `src/pages/ProductEdit.tsx`, `src/pages/ProductDetail.tsx`,
  `src/lib/products.ts`, `src/types/catalogue.ts`, `src/App.tsx`,
  `src/layout/AppSidebar.tsx`
- ⚠️ **Action required:** run `0005_brands.sql`.

## 8. Companies (new — a company owns brands)
- New **Companies** page under Product (sidebar + `/product/companies`): name,
  slug, description, logo — mirrors Brands.
- A company **owns brands**: the Brand form gets an **optional** Company
  dropdown ("None" allowed); the Brands list shows and searches by company.
- Products still pick a **brand** only — a product's company is derived through
  its brand (no company_id on products).
- `useBrandsFull` falls back gracefully if 0006 hasn't run yet (company-free
  query), so the Brands page never breaks pre-migration.
- Files: `supabase/migrations/0006_companies.sql`, `src/pages/Companies.tsx`,
  `src/lib/companies.ts`, `src/hooks/useCompanies.ts`,
  `src/hooks/useCompaniesFull.ts`, `src/pages/Brands.tsx`,
  `src/lib/brands.ts`, `src/hooks/useBrandsFull.ts`, `src/types/catalogue.ts`,
  `src/App.tsx`, `src/layout/AppSidebar.tsx`
- ⚠️ **Action required:** run `0006_companies.sql`.

## 9. Company⇄Brand reshaped to many-to-many + company on products
- A **company owns brands** as a **many-to-many** (`brand_companies` join): a
  brand can belong to several companies. Old single `brands.company_id` was
  migrated into the join and dropped.
- **Assign brands from the Companies page** (brand checklist in the modal).
- **Products now pick a Company, then a filtered Brand.** Company drives the
  brand list; both required. Existing products backfilled to a "Generic"
  company. This is what makes company appear on the product Add/Edit forms.
- `useProduct` / `useBrandsFull` degrade gracefully pre-migration.
- Files: `supabase/migrations/0007_brand_companies.sql`,
  `src/hooks/useCompanyBrands.ts`, `src/pages/Companies.tsx`,
  `src/pages/Brands.tsx`, `src/lib/companies.ts`, `src/lib/brands.ts`,
  `src/hooks/useBrandsFull.ts`, `src/hooks/useCompaniesFull.ts`,
  `src/hooks/useProduct.ts`, `src/pages/ProductNew.tsx`,
  `src/pages/ProductEdit.tsx`, `src/pages/ProductDetail.tsx`,
  `src/lib/products.ts`, `src/types/catalogue.ts`
- ⚠️ **Action required:** run `0007_brand_companies.sql`.

---

## Outstanding action items (checklist)
- [ ] Run migration `0003_user_roles.sql`
- [ ] Run migration `0004_fix_admin_users_view.sql`
- [ ] Run migration `0005_brands.sql` (adds brands + backfills existing products to "Generic")
- [ ] Run migration `0006_companies.sql` (adds companies + optional brand→company link)
- [ ] Run migration `0007_brand_companies.sql` (company⇄brand many-to-many + company on products, backfills "Generic")
- [ ] Deploy Edge Function: `supabase functions deploy admin-users` + set `SERVICE_ROLE_KEY`
- [ ] Run `cim_junk_blast_radius.sql` and decide on deleting the `data-*` junk attributes

---

## Verification
- `npx tsc -b` → exit 0
- `npm run build` → succeeds
