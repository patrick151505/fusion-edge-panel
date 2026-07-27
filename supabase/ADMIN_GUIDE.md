# Admin & Schema Guide

Everything needed to build an admin panel that creates and edits products,
without reading the SQL. Covers the data model, the two product types, the
exact insert order, and the rules the database enforces for you.

If you only want to add a product by hand, skip to
[Adding products with SQL](#adding-products-with-sql) — the template files do
it in one paste.

---

## Before anything writes

**Every write to the catalogue requires an admin account.** Row-level security
allows `select` on published products for anyone, but `insert`, `update` and
`delete` on every catalogue table are gated behind `is_admin()`.

A user is made admin only by SQL run by a project owner — it cannot be set
from the app (a trigger blocks it, on purpose). To grant it:

```sql
update profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

The admin panel must call Supabase **as that signed-in admin user** (their
session's access token). Do **not** use the service-role key in a browser — it
bypasses RLS entirely and would expose full database access to anyone who
opens the page.

---

## The data model

Eleven tables. For product management you touch nine of them (not `profiles`
or `saved_items`).

```
categories ──┐
             ▼
          products ──── product_images
             │  │
             │  └────── product_attributes ──── product_attribute_terms
             │                    │                        │
             │            attributes ── attribute_terms ───┘
             │                                  │
             └────── variations ── variation_terms
```

### Products come in two kinds

| kind | What it is | Price | Options |
|---|---|---|---|
| `simple` | one product, one price | on the product row | none, or spec-only attributes |
| `variable` | one product, many buyable combinations | a **range**, computed from variations | Color, Size… form the combinations |

The `kind` column decides which rules apply — see [Rules the database
enforces](#rules-the-database-enforces).

### Attributes are global and reusable

`attributes` (Color, Size, Material) and their `attribute_terms` (Oak, Walnut,
140cm) are defined **once** and shared by every product. A product references
them through `product_attributes`; it never owns its own copy.

The key flag is **`product_attributes.used_for_variations`**:

- `true` → the attribute is a **choice** that forms variations (Color, Size).
  Shown as swatches/buttons on the product page.
- `false` → the attribute is a **spec** shown for information only (Material,
  Warranty). Creates no variations, no picker.

A single product can mix both: Color + Size as choices, Material + Warranty as
specs.

---

## Table reference

### `categories`
| column | notes |
|---|---|
| `name`, `slug` | slug is unique, used in URLs (`/shop?category=<slug>`) |
| `parent_id` | optional, for nested categories |
| `image_url`, `description`, `position` | optional display fields |

### `attributes`
| column | notes |
|---|---|
| `name`, `slug` | slug unique across the catalogue |
| `display_type` | `color` (swatch), `button` (pill), `select` (dropdown), `image` |
| `position` | display order on the product page |

### `attribute_terms`
| column | notes |
|---|---|
| `attribute_id` | which attribute this value belongs to |
| `name`, `slug` | slug unique **per attribute** — Color/black and Finish/black may coexist |
| `swatch` | hex (`#5c4033`) for a `color` attribute, or an image url for `image` |

### `products`
| column | notes |
|---|---|
| `name`, `slug` | slug unique, used in URLs (`/product/<slug>`) |
| `kind` | `simple` or `variable` |
| `category_id` | optional |
| `sku` | optional, unique |
| `price_cents`, `sale_price_cents` | **integer cents** — `$113.79` is `11379`. Never floats. |
| `price_max_cents` | **do not set for variable products** — a trigger fills it |
| `in_stock` | boolean; for variable products a trigger maintains it |
| `short_description`, `description` | short shows in the sidebar; long goes in the Description tab |
| `featured` | shown in the home hero carousel |
| `published` | **`false` hides it from the whole site.** New products are unpublished by default |

### `product_attributes`
Links a product to a global attribute.
| column | notes |
|---|---|
| `product_id`, `attribute_id` | unique together |
| `used_for_variations` | `true` = choice, `false` = spec (see above) |

### `product_attribute_terms`
Which of an attribute's terms this product offers. Global Color may know Black;
this narrows a given product to Oak + Walnut.

### `variations`
One buyable combination of a variable product.
| column | notes |
|---|---|
| `product_id` | parent |
| `price_cents`, `sale_price_cents` | **required** — each variation has its own price |
| `in_stock` | per variation |
| `sku` | optional, unique |

### `variation_terms`
The terms that define a variation — **one row per attribute**. "Oak / 180cm" is
two rows: `(variation, Color, Oak)` and `(variation, Size, 180cm)`.
Primary key `(variation_id, attribute_id)` makes "Oak *and* Walnut" impossible.

### `product_images`
| column | notes |
|---|---|
| `product_id` | parent |
| `variation_id` | **null** = default image (listing tiles, hero). **Set** = shown when that variation is selected |
| `url` | used verbatim as `<img src>` — an absolute `https://…` URL, or `/file.jpg` from `public/` |
| `alt`, `position` | `position` 0 is the main image, the rest become thumbnails |

---

## Creating a SIMPLE product

Minimum: one `products` row + at least one `product_images` row.

1. **`products`** — `kind='simple'`, set `price_cents`, `published=true`.
2. **`product_images`** — one row, `variation_id = null`.
3. *(optional)* spec attributes — `product_attributes` with
   `used_for_variations=false`, plus one `product_attribute_terms` per spec
   value.

That's it. No variations, no combinations.

## Creating a VARIABLE product

Order matters — each step references ids from the one before.

1. **`products`** — `kind='variable'`, **leave `price_cents` null** (the
   trigger fills the range). `published=true`.
2. **`product_attributes`** — one row per attribute used
   (`used_for_variations=true` for the choice attributes).
3. **`product_attribute_terms`** — the terms this product offers, e.g. Oak and
   Walnut but not Black.
4. **`variations`** — one row per combination you sell, each with its own
   `price_cents` and `in_stock`. You don't need every combination.
5. **`variation_terms`** — **two rows per variation** (Color + Size). This is
   the step that makes it "Oak / 140cm"; a variation with no terms is invisible.
6. **`product_images`** — a `variation_id = null` default, plus optional
   per-variation images.

**Step 5 is the one people forget.** A variation without its terms won't match
any picker selection and looks like a missing product.

---

## Rules the database enforces

You get these for free — the DB rejects or auto-corrects, so the admin panel
doesn't have to police them:

- **Simple products must have a price.** Insert without `price_cents` → rejected.
- **Variable products get their price range automatically.** A trigger sets
  `price_cents` (range low), `price_max_cents` (range high) and `in_stock`
  (true if *any* variation is) whenever variations change. Setting these by
  hand on a variable product is pointless — they'll be overwritten.
- **Sale price must be below the regular price.** Otherwise rejected.
- **A variation can't hold two terms of one attribute.** Can't be Oak *and*
  Walnut.
- **Deleting a product** cascades to its variations, images, attributes and
  terms. **Deleting a variation** removes its images but keeps the product's.
- **Unpublished products** (and their variations/images) are invisible to
  non-admins, so drafts are safe to save.
- **`is_admin` cannot be self-granted** — a trigger blocks it even though a
  user can edit their own profile row.

---

## Adding products with SQL

Three ready templates in this folder — edit the CONFIG block at the top, paste
into the Supabase SQL Editor, Run. All are re-runnable (they delete by slug
first).

| File | Use for |
|---|---|
| `add_product_template.sql` | variable product (Color × Size) |
| `add_simple_product_with_specs.sql` | simple product with spec attributes |
| `seed_example_variable_product.sql` | the worked "Miro Dining Table" example |
| `set_product_images.sql` | change a product's image URLs |
| `add_gallery_images.sql` | add extra gallery images |

`SETUP.sql` creates the whole schema from scratch (schema + security +
example) in one paste — for a fresh project only.

---

## Verifying schema changes

If you alter the schema, run the checks before trusting them:

```bash
node supabase/verify.mjs
```

It applies both migrations to a real Postgres (in-memory) and asserts every
constraint, trigger, cascade and security rule — 31 checks. It runs the
security checks as a non-admin, which is the only way to prove the policies
actually block what they should.

---

## Building the admin panel — checklist

- Authenticate as an **admin** user; use their session token, never the
  service-role key.
- For a **simple** product: insert `products` (+ images). Optionally add spec
  attributes with `used_for_variations=false`.
- For a **variable** product: follow the 6-step order above. Don't set the
  price range — let the trigger.
- Prices are **integer cents** in every field.
- `published=false` is a safe draft state — set it `true` to go live.
- To let variation selection swap the gallery, attach images with a
  `variation_id`.
- Reuse global attributes/terms across products; only add new ones when a
  genuinely new option appears.
