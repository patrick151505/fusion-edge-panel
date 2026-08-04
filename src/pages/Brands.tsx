import { useState } from "react";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import Label from "../components/form/Label";
import Input from "../components/form/input/InputField";
import MediaPicker from "../components/media/MediaPicker";
import { Modal } from "../components/ui/modal";
import { ListToolbar, Pager } from "../components/common/ListControls";
import { useBrandsFull } from "../hooks/useBrandsFull";
import { useTableControls } from "../hooks/useTableControls";
import { useToast } from "../context/ToastContext";
import {
  countBrandProducts,
  createBrand,
  deleteBrand,
  updateBrand,
  validateBrand,
  slugify,
  type BrandInput,
} from "../lib/brands";
import type { BrandFull } from "../types/catalogue";

const shell =
  "rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]";
const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-white/90";

const EMPTY: BrandInput = {
  name: "",
  slug: "",
  description: null,
  logo_url: null,
  position: 0,
};

export default function Brands() {
  const { brands, loading, error, reload } = useBrandsFull();
  const { notify } = useToast();

  const [form, setForm] = useState<BrandInput>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const controls = useTableControls({
    rows: brands,
    searchFields: (b) => [b.name, b.slug, b.description],
    sorters: {
      name: (a, b) => a.name.localeCompare(b.name),
      slug: (a, b) => a.slug.localeCompare(b.slug),
      products: (a, b) => (a.product_count ?? 0) - (b.product_count ?? 0),
      position: (a, b) => a.position - b.position,
    },
    initialSort: "name",
  });

  const set = <K extends keyof BrandInput>(k: K, v: BrandInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const resetForm = () => {
    setForm(EMPTY);
    setEditingId(null);
    setSlugEdited(false);
    setFormError(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const startAdd = () => {
    resetForm();
    setModalOpen(true);
  };

  const startEdit = (b: BrandFull) => {
    setEditingId(b.id);
    setSlugEdited(true);
    setFormError(null);
    setForm({
      name: b.name,
      slug: b.slug,
      description: b.description,
      logo_url: b.logo_url,
      position: b.position,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload: BrandInput = {
      ...form,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description?.trim() || null,
      logo_url: form.logo_url?.trim() || null,
    };

    const problem = validateBrand(payload, brands, editingId ?? undefined);
    if (problem) {
      setFormError(problem);
      notify("error", "Check the form", problem);
      return;
    }

    setSaving(true);
    const { error } = editingId
      ? await updateBrand(editingId, payload)
      : await createBrand(payload);
    setSaving(false);

    if (error) {
      setFormError(error);
      notify("error", editingId ? "Update failed" : "Create failed", error);
      return;
    }

    notify(
      "success",
      editingId ? "Brand updated" : "Brand created",
      payload.name
    );
    closeModal();
    reload();
  };

  const handleDelete = async (b: BrandFull) => {
    const used = await countBrandProducts(b.id);
    const msg =
      used > 0
        ? `Delete "${b.name}"? ${used} product${
            used > 1 ? "s" : ""
          } will lose this brand. Products are not deleted.`
        : `Delete "${b.name}"?`;
    if (!window.confirm(msg)) return;

    const { error } = await deleteBrand(b.id);
    if (error) notify("error", "Delete failed", error);
    else {
      notify("info", "Brand deleted", b.name);
      if (editingId === b.id) resetForm();
      reload();
    }
  };

  return (
    <div>
      <PageMeta title="Brands | FusionEdge" description="Manage product brands" />
      <PageBreadcrumb pageTitle="Brands" />

      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center h-11 px-4 text-sm font-medium text-white rounded-lg bg-brand-500 hover:bg-brand-600"
          >
            + Add brand
          </button>
        </div>

        {/* Create / edit form, in a modal */}
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          className="max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
        >
          <form onSubmit={handleSubmit}>
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
              {editingId ? "Edit brand" : "Add brand"}
            </h3>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>
                  Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugEdited) set("slug", slugify(e.target.value));
                  }}
                />
              </div>
              <div>
                <Label>
                  Slug <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    set("slug", e.target.value);
                    setSlugEdited(true);
                  }}
                />
              </div>
              <div>
                <Label>Position</Label>
                <Input
                  type="number"
                  value={String(form.position)}
                  onChange={(e) => set("position", Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="mt-5">
              <Label>Description</Label>
              <textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                className={`${inputClass} h-auto py-2.5`}
              />
            </div>

            <div className="mt-5">
              <Label>Logo</Label>
              <div className="flex gap-2">
                <Input
                  value={form.logo_url ?? ""}
                  placeholder="Logo URL (optional)"
                  onChange={(e) => set("logo_url", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                >
                  Choose
                </button>
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-error-500">{formError}</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add brand"}
              </button>
            </div>
          </form>
        </Modal>

        {/* List */}
        {loading ? (
          <div className={shell}>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
          </div>
        ) : error ? (
          <div className="p-6 border rounded-2xl border-error-500/30 bg-error-50 dark:bg-error-500/10">
            <p className="text-sm text-error-600 dark:text-error-400">{error}</p>
          </div>
        ) : brands.length === 0 ? (
          <div className={`${shell} text-center`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No brands yet. Use “Add brand” to create one.
            </p>
          </div>
        ) : (
          <>
            <ListToolbar
              query={controls.query}
              onQuery={controls.setQuery}
              placeholder="Search name, slug or description"
              sortKey={controls.sortKey}
              onSortKey={controls.setSortKey}
              sortOptions={[
                { value: "name", label: "Name" },
                { value: "slug", label: "Slug" },
                { value: "products", label: "Products" },
                { value: "position", label: "Position" },
              ]}
              dir={controls.dir}
              onToggleDir={controls.toggleDir}
              summary={
                controls.total === 0
                  ? "No matches"
                  : `${controls.rangeStart}–${controls.rangeEnd} of ${controls.total}`
              }
            />

            {controls.total === 0 ? (
              <div className={`${shell} text-center`}>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No brand matches “{controls.query}”.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {controls.rows.map((b) => (
                  <div
                    key={b.id}
                    className={`${shell} flex flex-wrap items-center gap-4`}
                  >
                    {b.logo_url ? (
                      <img
                        src={b.logo_url}
                        alt={b.name}
                        className="object-contain w-12 h-12 rounded-lg shrink-0 bg-gray-50 dark:bg-white/[0.06]"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 dark:bg-gray-800" />
                    )}

                    <div className="flex-1 min-w-40">
                      <span className="block font-medium text-gray-800 dark:text-white/90">
                        {b.name}
                      </span>
                      <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                        /{b.slug}
                      </span>
                    </div>

                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {b.product_count} product{b.product_count === 1 ? "" : "s"}
                    </span>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(b)}
                        className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="h-9 px-3 text-sm text-gray-400 rounded-lg hover:text-error-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Pager
              page={controls.page}
              pageCount={controls.pageCount}
              onPage={controls.setPage}
            />
          </>
        )}
      </div>

      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(url) => set("logo_url", url)}
      />
    </div>
  );
}
