// Runs the migrations against a real Postgres (PGlite/WASM) before they are
// pasted into Supabase, then exercises the constraints and triggers. Catches
// syntax errors, bad references, and logic bugs without touching a live
// project.
//
//   node supabase/verify.mjs

import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const sql = (f) => readFileSync(new URL(`./migrations/${f}`, import.meta.url), 'utf8')

let failures = 0
const check = (label, ok, detail = '') => {
  console.log((ok ? 'ok   ' : 'FAIL ') + label + (detail ? ` — ${detail}` : ''))
  if (!ok) failures++
}

// Supabase provides these; PGlite does not. Stub the minimum the migrations
// reference so the DDL runs unmodified.
await db.exec(`
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  -- nullif so an unset value reads as anonymous rather than raising.
  create or replace function auth.uid() returns uuid
    language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid
    $$;
`)

// --------------------------------------------------------------- run the DDL

try {
  await db.exec(sql('0001_init.sql'))
  check('0001_init.sql applies', true)
} catch (e) {
  check('0001_init.sql applies', false, e.message)
  process.exit(1)
}

try {
  await db.exec(sql('0002_rls.sql'))
  check('0002_rls.sql applies', true)
} catch (e) {
  check('0002_rls.sql applies', false, e.message)
  process.exit(1)
}

// ------------------------------------------------------------------ fixtures

const one = async (q, p) => (await db.query(q, p)).rows[0]

const cat = await one(
  `insert into categories (name, slug) values ('Tables','tables') returning id`
)
const color = await one(
  `insert into attributes (name, slug, display_type)
   values ('Color','color','color') returning id`
)
const size = await one(
  `insert into attributes (name, slug) values ('Size','size') returning id`
)
const oak = await one(
  `insert into attribute_terms (attribute_id, name, slug, swatch)
   values ($1,'Oak','oak','#d2b48c') returning id`,
  [color.id]
)
const walnut = await one(
  `insert into attribute_terms (attribute_id, name, slug, swatch)
   values ($1,'Walnut','walnut','#5c4033') returning id`,
  [color.id]
)
const s140 = await one(
  `insert into attribute_terms (attribute_id, name, slug)
   values ($1,'140cm','140cm') returning id`,
  [size.id]
)
const s180 = await one(
  `insert into attribute_terms (attribute_id, name, slug)
   values ($1,'180cm','180cm') returning id`,
  [size.id]
)

// Same slug under a different attribute must be allowed.
try {
  await db.query(
    `insert into attribute_terms (attribute_id, name, slug) values ($1,'Oak','oak')`,
    [size.id]
  )
  check('term slugs are unique per attribute, not globally', true)
} catch (e) {
  check('term slugs are unique per attribute, not globally', false, e.message)
}

// ------------------------------------------------------------ simple product

const simple = await one(
  `insert into products (category_id, name, slug, kind, price_cents, published)
   values ($1,'Teapot','teapot','simple',12005,true) returning id`,
  [cat.id]
)
check('simple product inserts', Boolean(simple.id))

try {
  await db.query(
    `insert into products (name, slug, kind) values ('Bad','bad','simple')`
  )
  check('simple product requires a price', false, 'insert without price succeeded')
} catch {
  check('simple product requires a price', true)
}

try {
  await db.query(
    `insert into products (name, slug, kind, price_cents, sale_price_cents)
     values ('Bad2','bad2','simple',1000,2000)`
  )
  check('sale price must be below regular price', false, 'higher sale price accepted')
} catch {
  check('sale price must be below regular price', true)
}

// ---------------------------------------------------------- variable product

const table = await one(
  `insert into products (category_id, name, slug, kind, published)
   values ($1,'Miro Dining Table','miro-dining-table','variable',true)
   returning id`,
  [cat.id]
)

const paColor = await one(
  `insert into product_attributes (product_id, attribute_id)
   values ($1,$2) returning id`,
  [table.id, color.id]
)
const paSize = await one(
  `insert into product_attributes (product_id, attribute_id)
   values ($1,$2) returning id`,
  [table.id, size.id]
)
for (const [pa, term] of [
  [paColor.id, oak.id],
  [paColor.id, walnut.id],
  [paSize.id, s140.id],
  [paSize.id, s180.id],
]) {
  await db.query(
    `insert into product_attribute_terms (product_attribute_id, term_id)
     values ($1,$2)`,
    [pa, term]
  )
}

const mkVariation = async (price, stock, terms, salePrice = null) => {
  const v = await one(
    `insert into variations (product_id, price_cents, sale_price_cents, in_stock)
     values ($1,$2,$3,$4) returning id`,
    [table.id, price, salePrice, stock]
  )
  for (const [attr, term] of terms) {
    await db.query(
      `insert into variation_terms (variation_id, attribute_id, term_id)
       values ($1,$2,$3)`,
      [v.id, attr, term]
    )
  }
  return v.id
}

const vOak140 = await mkVariation(11379, true, [
  [color.id, oak.id],
  [size.id, s140.id],
])
await mkVariation(14900, true, [
  [color.id, oak.id],
  [size.id, s180.id],
])
await mkVariation(16750, false, [
  [color.id, walnut.id],
  [size.id, s180.id],
])

// A variation cannot hold two terms of the same attribute.
try {
  await db.query(
    `insert into variation_terms (variation_id, attribute_id, term_id)
     values ($1,$2,$3)`,
    [vOak140, color.id, walnut.id]
  )
  check('variation cannot have two terms of one attribute', false, 'duplicate accepted')
} catch {
  check('variation cannot have two terms of one attribute', true)
}

// ------------------------------------------------------- price-range trigger

let p = await one(
  `select price_cents, price_max_cents, in_stock from products where id = $1`,
  [table.id]
)
check(
  'trigger derives price range from variations',
  p.price_cents === 11379 && p.price_max_cents === 16750,
  `got ${p.price_cents}..${p.price_max_cents}, expected 11379..16750`
)
check('variable product in stock when any variation is', p.in_stock === true)

// A sale price should pull the range minimum down.
await db.query(`update variations set sale_price_cents = 9999 where id = $1`, [
  vOak140,
])
p = await one(`select price_cents from products where id = $1`, [table.id])
check(
  'sale price lowers the range minimum',
  p.price_cents === 9999,
  `got ${p.price_cents}, expected 9999`
)

// All variations out of stock => product out of stock.
await db.query(`update variations set in_stock = false where product_id = $1`, [
  table.id,
])
p = await one(`select in_stock from products where id = $1`, [table.id])
check('product goes out of stock when every variation does', p.in_stock === false)

// Deleting variations should not strand a stale price.
await db.query(`delete from variations where product_id = $1`, [table.id])
p = await one(
  `select price_cents, in_stock from products where id = $1`,
  [table.id]
)
check(
  'deleting all variations clears the price range',
  p.price_cents === null && p.in_stock === false,
  `got price=${p.price_cents} in_stock=${p.in_stock}`
)

// -------------------------------------------------------------------- images

const vimg = await mkVariation(11379, true, [
  [color.id, oak.id],
  [size.id, s140.id],
])
await db.query(
  `insert into product_images (product_id, url, position) values ($1,'/a.jpg',0)`,
  [table.id]
)
await db.query(
  `insert into product_images (product_id, variation_id, url, position)
   values ($1,$2,'/oak.jpg',1)`,
  [table.id, vimg]
)
const imgs = await db.query(
  `select count(*)::int n from product_images where product_id = $1`,
  [table.id]
)
check('product and variation images coexist', imgs.rows[0].n === 2)

// Deleting a variation must not delete the product-level image.
await db.query(`delete from variations where id = $1`, [vimg])
const left = await db.query(
  `select count(*)::int n from product_images where product_id = $1`,
  [table.id]
)
check(
  'deleting a variation keeps product-level images',
  left.rows[0].n === 1,
  `${left.rows[0].n} image(s) remain`
)

// --------------------------------------------------------------- saved items

const user = await one(
  `insert into auth.users (email, raw_user_meta_data)
   values ('a@b.c','{"full_name":"Ann"}'::jsonb) returning id`
)
const prof = await one(`select full_name from profiles where id = $1`, [user.id])
check(
  'signup trigger creates a profile',
  prof?.full_name === 'Ann',
  `got ${JSON.stringify(prof)}`
)

await db.query(`insert into saved_items (user_id, product_id) values ($1,$2)`, [
  user.id,
  simple.id,
])
try {
  await db.query(`insert into saved_items (user_id, product_id) values ($1,$2)`, [
    user.id,
    simple.id,
  ])
  check('a product can only be saved once per user', false, 'duplicate accepted')
} catch {
  check('a product can only be saved once per user', true)
}

const v1 = await mkVariation(11379, true, [
  [color.id, oak.id],
  [size.id, s140.id],
])
const v2 = await mkVariation(14900, true, [
  [color.id, oak.id],
  [size.id, s180.id],
])
await db.query(
  `insert into saved_items (user_id, product_id, variation_id) values ($1,$2,$3)`,
  [user.id, table.id, v1]
)
await db.query(
  `insert into saved_items (user_id, product_id, variation_id) values ($1,$2,$3)`,
  [user.id, table.id, v2]
)
check('different variations of one product can both be saved', true)

try {
  await db.query(
    `insert into saved_items (user_id, product_id, variation_id) values ($1,$2,$3)`,
    [user.id, table.id, v1]
  )
  check('the same variation cannot be saved twice', false, 'duplicate accepted')
} catch {
  check('the same variation cannot be saved twice', true)
}

// Saving the product as a whole is separate from saving its variations.
await db.query(`insert into saved_items (user_id, product_id) values ($1,$2)`, [
  user.id,
  table.id,
])
const saved = await db.query(
  `select count(*)::int n from saved_items where user_id = $1`,
  [user.id]
)
check(
  'product-level and variation-level saves coexist',
  saved.rows[0].n === 4,
  `${saved.rows[0].n} rows, expected 4`
)

// Deleting a user removes their library.
await db.query(`delete from auth.users where id = $1`, [user.id])
const after = await db.query(`select count(*)::int n from saved_items`)
check('deleting a user clears their saved items', after.rows[0].n === 0)

// ----------------------------------------------------------------- RLS shape

const noPolicy = await db.query(`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
`)
check(
  'every RLS-enabled table has at least one policy',
  noPolicy.rows.length === 0,
  noPolicy.rows.map((r) => r.relname).join(', ')
)

const unprotected = await db.query(`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
`)
check(
  'every public table has RLS enabled',
  unprotected.rows.length === 0,
  unprotected.rows.map((r) => r.relname).join(', ')
)

// ------------------------------------------------------- RLS enforcement
//
// The checks above run as superuser, which bypasses RLS entirely. These run as
// an ordinary role so the policies are actually applied — that difference is
// what catches a policy that is present but ineffective.

const pub = await one(
  `insert into products (name, slug, kind, price_cents, published)
   values ('Pub','pub','simple',100,true) returning id`
)
const draft = await one(
  `insert into products (name, slug, kind, price_cents, published)
   values ('Draft','draft','simple',100,false) returning id`
)
const u1 = await one(`insert into auth.users (email) values ('u1@x.c') returning id`)
const u2 = await one(`insert into auth.users (email) values ('u2@x.c') returning id`)
await db.query(`insert into saved_items (user_id, product_id) values ($1,$2)`, [
  u1.id,
  pub.id,
])

await db.exec(`
  create role app nosuperuser;
  grant usage on schema public, auth to app;
  grant select, insert, update, delete on all tables in schema public to app;
  grant select on auth.users to app;
  grant execute on all functions in schema public, auth to app;
`)

// Run a statement as `app` with auth.uid() bound to a given user.
const as = async (uid, q, p) => {
  await db.exec(`set role app`)
  await db.query(`select set_config('test.uid', $1, false)`, [uid || ''])
  try {
    return { rows: (await db.query(q, p)).rows }
  } catch (e) {
    return { err: e.message }
  } finally {
    await db.exec(`reset role`)
  }
}

// Scoped to this pair: earlier fixtures left other published rows behind.
let r = await as(
  null,
  `select count(*)::int n from products where id in ($1,$2)`,
  [pub.id, draft.id]
)
check(
  'anon sees published products but not drafts',
  r.rows?.[0].n === 1,
  `saw ${r.rows?.[0].n} of 2`
)

r = await as(null, `select count(*)::int n from products where id = $1`, [draft.id])
check('the draft itself is invisible to anon', r.rows?.[0].n === 0)

r = await as(u2.id, `select count(*)::int n from saved_items`)
check("a user cannot read another user's library", r.rows?.[0].n === 0)

r = await as(u1.id, `select count(*)::int n from saved_items`)
check('a user reads their own library', r.rows?.[0].n === 1)

r = await as(
  u2.id,
  `insert into saved_items (user_id, product_id) values ($1,$2)`,
  [u1.id, pub.id]
)
check('cannot save on behalf of another user', Boolean(r.err))

r = await as(
  u2.id,
  `insert into saved_items (user_id, product_id) values ($1,$2)`,
  [u2.id, draft.id]
)
check('cannot save an unpublished product', Boolean(r.err))

r = await as(u2.id, `update products set price_cents = 1 where id = $1`, [pub.id])
check('a non-admin cannot edit the catalog', r.rows?.length === 0 || Boolean(r.err))

// Privilege escalation: RLS is row-level, so without the guard trigger this
// update succeeds and hands the user full admin rights.
r = await as(u2.id, `update profiles set is_admin = true where id = $1`, [u2.id])
const escalated = await one(`select is_admin from profiles where id = $1`, [u2.id])
check(
  'a user cannot grant themselves admin',
  escalated.is_admin === false,
  escalated.is_admin ? 'PRIVILEGE ESCALATION' : ''
)

// The guard must not block legitimate edits to other fields.
r = await as(u2.id, `update profiles set full_name = 'Renamed' where id = $1`, [
  u2.id,
])
const renamed = await one(`select full_name from profiles where id = $1`, [u2.id])
check('a user can still edit their own name', renamed.full_name === 'Renamed')

console.log(
  failures === 0
    ? '\nAll schema checks passed.'
    : `\n${failures} check(s) failed.`
)
process.exit(failures === 0 ? 0 : 1)
