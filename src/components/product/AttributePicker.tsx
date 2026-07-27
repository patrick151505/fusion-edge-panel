import type { ProductAttribute } from "../../types/catalogue";
import type { Selection } from "../../lib/variations";

type Props = {
  attributes: ProductAttribute[];
  selection: Selection;
  onSelect: (attributeId: string, termId: string) => void;
  /** term ids reachable given the other choices */
  availableFor: (attributeId: string) => Set<string>;
  /** term ids whose every variation is out of stock */
  soldOutFor: (attributeId: string) => Set<string>;
};

export default function AttributePicker({
  attributes,
  selection,
  onSelect,
  availableFor,
  soldOutFor,
}: Props) {
  return (
    <div className="space-y-5">
      {attributes.map((pa) => {
        const attrId = pa.attribute.id;
        const available = availableFor(attrId);
        const soldOut = soldOutFor(attrId);
        const chosen = selection[attrId];

        return (
          <div key={pa.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {pa.attribute.name}
              </span>
              {chosen && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {pa.terms.find((t) => t.id === chosen)?.name}
                </span>
              )}
            </div>

            {pa.attribute.display_type === "select" ? (
              <select
                value={chosen ?? ""}
                onChange={(e) => onSelect(attrId, e.target.value)}
                className="h-11 w-full max-w-xs rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">Choose {pa.attribute.name}</option>
                {pa.terms.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={!available.has(t.id)}
                  >
                    {t.name}
                    {soldOut.has(t.id) ? " — out of stock" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pa.terms.map((t) => {
                  const isChosen = chosen === t.id;
                  const unavailable = !available.has(t.id);
                  const isSoldOut = soldOut.has(t.id);
                  const dim = unavailable || isSoldOut;

                  if (pa.attribute.display_type === "color") {
                    return (
                      <button
                        key={t.id}
                        onClick={() => onSelect(attrId, t.id)}
                        disabled={unavailable}
                        title={`${t.name}${isSoldOut ? " (out of stock)" : ""}`}
                        aria-label={t.name}
                        aria-pressed={isChosen}
                        className={`relative h-9 w-9 rounded-full border-2 transition ${
                          isChosen
                            ? "border-brand-500 ring-2 ring-brand-500/25"
                            : "border-gray-200 dark:border-gray-700"
                        } ${dim ? "opacity-40" : "hover:border-gray-400"} ${
                          unavailable ? "cursor-not-allowed" : ""
                        }`}
                        style={{ backgroundColor: t.swatch ?? "#e5e7eb" }}
                      >
                        {isSoldOut && (
                          <span className="absolute inset-0 flex items-center justify-center text-lg leading-none text-white mix-blend-difference">
                            /
                          </span>
                        )}
                      </button>
                    );
                  }

                  // 'button' and 'image' both render as a labelled pill.
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelect(attrId, t.id)}
                      disabled={unavailable}
                      aria-pressed={isChosen}
                      className={`h-10 rounded-lg border px-4 text-sm font-medium transition ${
                        isChosen
                          ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                          : "border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
                      } ${
                        dim ? "opacity-40" : ""
                      } ${unavailable ? "cursor-not-allowed line-through" : ""}`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
