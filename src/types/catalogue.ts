export type ProductKind = "simple" | "variable";

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  position: number;
  variation_id: string | null;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
};

/** A category row with the management fields the admin page edits. */
export type CategoryFull = Category & {
  parent_id: string | null;
  description: string | null;
  image_url: string | null;
  position: number;
  /** Number of products in this category — filled in by the admin query. */
  product_count?: number;
};

export type DisplayType = "select" | "button" | "color" | "image";

export type AttributeTerm = {
  id: string;
  name: string;
  slug: string;
  /** Hex for a `color` attribute, image url for `image`. */
  swatch: string | null;
  position: number;
};

export type Attribute = {
  id: string;
  name: string;
  slug: string;
  display_type: DisplayType;
  position: number;
};

/** A global attribute with its full term pool — the reusable definition. */
export type AttributeWithTerms = Attribute & {
  terms: AttributeTerm[];
};

/** An attribute as offered by one product, narrowed to its own terms. */
export type ProductAttribute = {
  id: string;
  /** true = a buyable choice forming variations; false = a display-only spec. */
  used_for_variations: boolean;
  position: number;
  attribute: Attribute;
  terms: AttributeTerm[];
  /** Term preselected on the product page. Null means no default. */
  default_term_id?: string | null;
};

/** One buyable combination. `terms` is one entry per attribute. */
export type Variation = {
  id: string;
  sku: string | null;
  price_cents: number;
  sale_price_cents: number | null;
  in_stock: boolean;
  position: number;
  terms: { attribute_id: string; term_id: string }[];
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  kind: ProductKind;
  short_description: string | null;
  /** Integer cents. For variable products this is the low end of the range. */
  price_cents: number | null;
  sale_price_cents: number | null;
  /** Integer cents. Set by trigger on variable products only. */
  price_max_cents: number | null;
  in_stock: boolean;
  featured: boolean;
  published: boolean;
  created_at: string;
  category: Category | null;
  images: ProductImage[];
};

export type ProductDetail = Product & {
  description: string | null;
  attributes: ProductAttribute[];
  variations: Variation[];
};
