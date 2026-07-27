import { useEffect, useMemo, useState } from "react";
import type { ProductDetail } from "../../types/catalogue";

type Props = {
  product: ProductDetail;
  /** When set, that variation's images lead the gallery. */
  variationId: string | null;
};

export default function ProductGallery({ product, variationId }: Props) {
  // A selected variation shows its own images first, then the shared ones.
  const images = useMemo(() => {
    const shared = product.images.filter((i) => i.variation_id === null);
    if (!variationId) return shared.length ? shared : product.images;

    const own = product.images.filter((i) => i.variation_id === variationId);
    return [...own, ...shared];
  }, [product.images, variationId]);

  const [active, setActive] = useState(0);

  // Swapping variation can shorten the list — never point past the end.
  useEffect(() => {
    setActive(0);
  }, [variationId]);

  const main = images[Math.min(active, images.length - 1)];

  if (!main) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 aspect-square dark:border-gray-800 dark:bg-white/[0.03]">
        <span className="text-sm text-gray-400">No image</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden border border-gray-200 rounded-2xl bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]">
        <img
          src={main.url}
          alt={main.alt ?? product.name}
          className="object-cover w-full aspect-square"
        />
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-3">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === active}
              className={`overflow-hidden rounded-lg border transition ${
                i === active
                  ? "border-brand-500 ring-2 ring-brand-500/20"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-800"
              }`}
            >
              <img
                src={img.url}
                alt={img.alt ?? ""}
                className="object-cover w-full aspect-square"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
