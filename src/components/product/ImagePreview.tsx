import { useState } from "react";
import Label from "../form/Label";
import Input from "../form/input/InputField";

/** One thumbnail that reports a broken URL instead of showing a dead icon. */
function Thumb({
  url,
  index,
  onRemove,
}: {
  url: string;
  index: number;
  onRemove: () => void;
}) {
  const [broken, setBroken] = useState(false);

  return (
    <div className="relative group">
      <div className="overflow-hidden border border-gray-200 rounded-lg aspect-square bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]">
        {broken ? (
          <div className="flex items-center justify-center h-full px-1 text-center">
            <span className="text-theme-xs text-error-500">Can’t load</span>
          </div>
        ) : (
          <img
            src={url}
            alt={`Image ${index + 1}`}
            className="object-cover w-full h-full"
            onError={() => setBroken(true)}
          />
        )}
      </div>

      {/* Position 0 is the main image on the storefront. */}
      {index === 0 && (
        <span className="absolute px-1.5 py-0.5 text-theme-xs font-medium text-white rounded top-1 left-1 bg-brand-500">
          Main
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove image ${index + 1}`}
        className="absolute flex items-center justify-center w-5 h-5 text-white transition rounded-full opacity-0 top-1 right-1 bg-error-500 group-hover:opacity-100 hover:bg-error-600"
      >
        ×
      </button>
    </div>
  );
}

type Props = {
  /** Raw URL strings from the form, may include blanks. */
  urls: string[];
  onChangeAt: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  /** Opens the media library for a given row. */
  onChoose: (index: number) => void;
  error?: string;
};

/** The product's images: URL fields and their live previews in one card. */
export default function ImagePreview({
  urls,
  onChangeAt,
  onAdd,
  onRemove,
  onChoose,
  error,
}: Props) {
  // Keep the original index so removal targets the right form row.
  const filled = urls
    .map((url, index) => ({ url: url.trim(), index }))
    .filter((u) => u.url !== "");

  return (
    <div>
      <Label>
        Images <span className="text-error-500">*</span>
      </Label>

      {/* Previews first, so the result is what you see before the fields. */}
      {filled.length === 0 ? (
        <div className="flex items-center justify-center mb-4 border border-dashed border-gray-300 rounded-lg aspect-square dark:border-gray-700">
          <span className="text-sm text-gray-400">No image yet</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {filled.map((u) => (
            <Thumb
              key={`${u.index}-${u.url}`}
              url={u.url}
              index={u.index}
              onRemove={() => onRemove(u.index)}
            />
          ))}
        </div>
      )}

      {/* URL fields, one per image slot. */}
      <div className="space-y-2">
        {urls.map((url, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={url}
              placeholder={i === 0 ? "Main image URL" : "Image URL"}
              error={!!error}
              onChange={(e) => onChangeAt(i, e.target.value)}
            />
            <button
              type="button"
              onClick={() => onChoose(i)}
              className="h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              Choose
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-2 text-sm font-medium text-brand-500 hover:text-brand-600"
      >
        + Add image
      </button>

      {error ? (
        <p className="mt-1 text-theme-xs text-error-500">{error}</p>
      ) : (
        <p className="mt-1 text-theme-xs text-gray-400">
          The first image is used on listings and the product hero.
        </p>
      )}
    </div>
  );
}
