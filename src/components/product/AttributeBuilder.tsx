import { useState } from "react";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import MediaPicker from "../media/MediaPicker";
import {
  createAttribute,
  createTerm,
  type AttributeAssignment,
} from "../../lib/attributes";
import type { AttributeWithTerms, DisplayType } from "../../types/catalogue";

type Props = {
  /** The global attribute pool. */
  pool: AttributeWithTerms[];
  /** Assignments currently on the product. */
  value: AttributeAssignment[];
  onChange: (next: AttributeAssignment[]) => void;
  /** Reload the pool after creating a new attribute/term. */
  onPoolChange: () => void;
  notify: (v: "success" | "error", t: string, m: string) => void;
  /**
   * Only variable products can turn an attribute into buyable variations.
   * On a simple product the "used for variations" control is hidden and
   * every attribute stays a spec — no dead pickers.
   */
  isVariable: boolean;
  /**
   * When set, values added here are private to this product (not the shared
   * pool). Null/absent means new values would be global — used before the
   * product exists.
   */
  productId?: string | null;
};

export default function AttributeBuilder({
  pool,
  value,
  onChange,
  onPoolChange,
  notify,
  isVariable,
  productId = null,
}: Props) {
  const [picker, setPicker] = useState("");
  const [newAttrName, setNewAttrName] = useState("");
  const [newAttrType, setNewAttrType] = useState<DisplayType>("select");
  const [showNewAttr, setShowNewAttr] = useState(false);
  // Per-attribute "add a value" inputs, keyed by attribute id.
  const [termDraft, setTermDraft] = useState<Record<string, string>>({});
  // Per-attribute swatch hex, only used for color-type attributes.
  const [swatchDraft, setSwatchDraft] = useState<Record<string, string>>({});
  // Per-attribute image URL, only used for image-type attributes.
  const [imageDraft, setImageDraft] = useState<Record<string, string>>({});
  // Which attribute's image URL the media picker is filling, or null.
  const [pickerAttr, setPickerAttr] = useState<string | null>(null);

  const used = new Set(value.map((a) => a.attribute_id));
  const available = pool.filter((a) => !used.has(a.id));

  const addAssignment = (attributeId: string) => {
    if (!attributeId || used.has(attributeId)) return;
    onChange([
      ...value,
      { attribute_id: attributeId, used_for_variations: false, term_ids: [] },
    ]);
    setPicker("");
  };

  const removeAssignment = (attributeId: string) =>
    onChange(value.filter((a) => a.attribute_id !== attributeId));

  const patch = (attributeId: string, next: Partial<AttributeAssignment>) =>
    onChange(
      value.map((a) => (a.attribute_id === attributeId ? { ...a, ...next } : a))
    );

  const toggleTerm = (attributeId: string, termId: string) => {
    const a = value.find((x) => x.attribute_id === attributeId);
    if (!a) return;
    const has = a.term_ids.includes(termId);
    patch(attributeId, {
      term_ids: has
        ? a.term_ids.filter((t) => t !== termId)
        : [...a.term_ids, termId],
      // Deselecting the term that was the default leaves it dangling.
      ...(has && a.default_term_id === termId ? { default_term_id: null } : {}),
    });
  };

  const handleCreateAttribute = async () => {
    if (!newAttrName.trim()) return;
    const { data, error } = await createAttribute(newAttrName, newAttrType);
    if (error || !data) {
      notify("error", "Could not create attribute", error ?? "Failed.");
      return;
    }
    notify("success", "Attribute created", `${data.name} added to the pool.`);
    setNewAttrName("");
    setShowNewAttr(false);
    onPoolChange();
    addAssignment(data.id);
  };

  const handleCreateTerm = async (attr: AttributeWithTerms) => {
    const name = (termDraft[attr.id] ?? "").trim();
    if (!name) return;

    // The swatch column carries a hex for color, an image URL for image,
    // and nothing for the plain (select/button) types.
    let swatch: string | null = null;
    if (attr.display_type === "color") {
      swatch = swatchDraft[attr.id] ?? "#000000";
    } else if (attr.display_type === "image") {
      const url = (imageDraft[attr.id] ?? "").trim();
      if (!url) {
        notify("error", "Image URL required", "Add an image URL for this value.");
        return;
      }
      if (!/^https?:\/\/|^\//.test(url)) {
        notify("error", "Bad image URL", "URL must start with http(s):// or /.");
        return;
      }
      swatch = url;
    }

    // Inside a product, values are private to it; otherwise global.
    const { data, error } = await createTerm(attr.id, name, swatch, productId);
    if (error || !data) {
      notify("error", "Could not add value", error ?? "Failed.");
      return;
    }
    setTermDraft((d) => ({ ...d, [attr.id]: "" }));
    setSwatchDraft((d) => ({ ...d, [attr.id]: "#000000" }));
    setImageDraft((d) => ({ ...d, [attr.id]: "" }));
    onPoolChange();
    // Auto-select the value we just created.
    toggleTerm(attr.id, data.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Attributes</Label>
        <button
          type="button"
          onClick={() => setShowNewAttr((s) => !s)}
          className="text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          {showNewAttr ? "Cancel" : "+ New attribute"}
        </button>
      </div>
      {!isVariable && (
        <p className="text-theme-xs text-gray-400">
          Attributes on a simple product are shown as specs (e.g. Material,
          Warranty). Switch to a variable product to turn them into buyable
          options.
        </p>
      )}

      {showNewAttr && (
        <div className="flex flex-wrap items-end gap-2 p-3 border border-gray-200 rounded-lg dark:border-gray-700">
          <div className="flex-1 min-w-40">
            <Label>Name</Label>
            <Input
              value={newAttrName}
              placeholder="e.g. Color"
              onChange={(e) => setNewAttrName(e.target.value)}
            />
          </div>
          <div>
            <Label>Display</Label>
            <select
              value={newAttrType}
              onChange={(e) => setNewAttrType(e.target.value as DisplayType)}
              className="h-11 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="select">Dropdown</option>
              <option value="button">Button</option>
              <option value="color">Color swatch</option>
              <option value="image">Image</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreateAttribute}
            className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600"
          >
            Create
          </button>
        </div>
      )}

      {/* Assigned attributes */}
      {value.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No attributes yet. Add one below to describe this product.
        </p>
      )}

      {value.map((assignment) => {
        const attr = pool.find((a) => a.id === assignment.attribute_id);
        if (!attr) return null;
        return (
          <div
            key={attr.id}
            className="p-4 border border-gray-200 rounded-lg dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-gray-800 dark:text-white/90">
                {attr.name}
                <span className="ml-2 text-theme-xs text-gray-400">
                  {attr.display_type}
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeAssignment(attr.id)}
                className="text-sm text-gray-400 hover:text-error-500"
              >
                Remove
              </button>
            </div>

            {/* Value (term) chips */}
            <div className="flex flex-wrap gap-2 mb-3">
              {attr.terms.map((t) => {
                const on = assignment.term_ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTerm(attr.id, t.id)}
                    className={`h-8 rounded-full border px-3 text-sm transition ${
                      on
                        ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                        : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {attr.display_type === "color" && t.swatch && (
                      <span
                        className="inline-block w-3 h-3 mr-1.5 rounded-full align-middle"
                        style={{ backgroundColor: t.swatch }}
                      />
                    )}
                    {attr.display_type === "image" && t.swatch && (
                      <img
                        src={t.swatch}
                        alt=""
                        className="inline-block object-cover w-4 h-4 mr-1.5 rounded align-middle"
                      />
                    )}
                    {t.name}
                  </button>
                );
              })}
              {attr.terms.length === 0 && (
                <span className="text-sm text-gray-400">No values yet.</span>
              )}
            </div>

            {/* Add a new value to this global attribute */}
            {attr.display_type === "image" && (
              <div className="flex gap-2">
                <Input
                  value={imageDraft[attr.id] ?? ""}
                  placeholder="Image URL (https://… or /file.jpg)"
                  onChange={(e) =>
                    setImageDraft((d) => ({ ...d, [attr.id]: e.target.value }))
                  }
                />
                <button
                  type="button"
                  onClick={() => setPickerAttr(attr.id)}
                  className="h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  Choose
                </button>
              </div>
            )}
            <div className="flex gap-2 mt-2 mb-3">
              {attr.display_type === "color" && (
                <input
                  type="color"
                  aria-label={`${attr.name} swatch color`}
                  value={swatchDraft[attr.id] ?? "#000000"}
                  onChange={(e) =>
                    setSwatchDraft((d) => ({ ...d, [attr.id]: e.target.value }))
                  }
                  className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-transparent dark:border-gray-700"
                />
              )}
              <Input
                value={termDraft[attr.id] ?? ""}
                placeholder={
                  attr.display_type === "color"
                    ? `${attr.name} name (+ pick a color)…`
                    : attr.display_type === "image"
                    ? `${attr.name} name (+ URL above)…`
                    : `Add a ${attr.name} value…`
                }
                onChange={(e) =>
                  setTermDraft((d) => ({ ...d, [attr.id]: e.target.value }))
                }
              />
              <button
                type="button"
                onClick={() => handleCreateTerm(attr)}
                className="h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Add value
              </button>
            </div>
            <p className="mb-3 text-theme-xs text-gray-400">
              {productId
                ? "Values added here belong to this product only. Manage shared values on the Attributes page."
                : "Values added here join the shared library for all products."}
            </p>

            {isVariable && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={assignment.used_for_variations}
                  onChange={(e) =>
                    patch(attr.id, {
                      used_for_variations: e.target.checked,
                      // A spec has no picker, so it can't carry a default.
                      ...(e.target.checked ? {} : { default_term_id: null }),
                    })
                  }
                  className="w-4 h-4 rounded accent-brand-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Used for variations
                </span>
                <span className="text-theme-xs text-gray-400">
                  (off = shown as a spec only)
                </span>
              </label>
            )}

            {/* Which value the product page opens with. */}
            {isVariable && assignment.used_for_variations && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Default:
                </span>
                <select
                  value={assignment.default_term_id ?? ""}
                  onChange={(e) =>
                    patch(attr.id, { default_term_id: e.target.value || null })
                  }
                  className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  <option value="">No default</option>
                  {/* Only terms this product offers can be the default. */}
                  {attr.terms
                    .filter((t) => assignment.term_ids.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <span className="text-theme-xs text-gray-400">
                  preselected on the product page
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Add an existing global attribute */}
      {available.length > 0 && (
        <div className="flex gap-2">
          <select
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
            className="h-11 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          >
            <option value="">Add existing attribute…</option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addAssignment(picker)}
            disabled={!picker}
            className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Add
          </button>
        </div>
      )}

      <MediaPicker
        isOpen={pickerAttr !== null}
        onClose={() => setPickerAttr(null)}
        onPick={(url) => {
          if (pickerAttr) setImageDraft((d) => ({ ...d, [pickerAttr]: url }));
        }}
      />
    </div>
  );
}
