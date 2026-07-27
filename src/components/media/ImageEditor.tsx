import { useEffect, useRef, useState } from "react";
import ReactCrop, { type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Modal } from "../ui/modal";
import { renderEdited, type Transform } from "../../lib/imageEdit";

type Props = {
  /** Image source to edit. Loaded cross-origin so the canvas isn't tainted. */
  src: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called with the edited image as a Blob (JPEG) when the user saves. */
  onSave: (blob: Blob) => Promise<void> | void;
  /** Save-button label; defaults to the overwrite wording. */
  saveLabel?: string;
  /**
   * When provided, shows a "Skip" action that uses the image as-is. Used on
   * upload so cropping is optional rather than forced.
   */
  onSkip?: () => Promise<void> | void;
  skipLabel?: string;
};

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: "Free", value: undefined },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

export default function ImageEditor({
  src,
  isOpen,
  onClose,
  onSave,
  saveLabel = "Save (overwrites original)",
  onSkip,
  skipLabel = "Skip cropping",
}: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completed, setCompleted] = useState<PixelCrop | null>(null);
  // Square is the sensible default for product imagery, matching the
  // square thumbnails the library and product tables render.
  const [aspect, setAspect] = useState<number | undefined>(1);
  const [rotate, setRotate] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  /**
   * Warm the browser's *CORS* cache entry before the visible <img> mounts.
   *
   * The crop image must be crossOrigin (otherwise the canvas is tainted and
   * toBlob() throws on save), and browsers cache CORS and non-CORS responses
   * separately — so the thumbnail already on screen is no help and the editor
   * would otherwise re-download before showing anything.
   */
  useEffect(() => {
    if (!isOpen) return;
    setLoaded(false);
    setLoadError(false);
    const pre = new Image();
    pre.crossOrigin = "anonymous";
    pre.src = src;
    // If it's already cached, the element below will resolve instantly.
    if (pre.complete) setLoaded(true);
  }, [isOpen, src]);

  /**
   * Pick an aspect ratio and immediately draw a centred crop at that ratio.
   *
   * Setting `aspect` alone only constrains the *next* drag, so without this the
   * button looks like it did nothing. Choosing "Free" clears the crop instead.
   */
  const applyAspect = (value: number | undefined) => {
    setAspect(value);
    const el = imgRef.current;
    if (!el || !value) {
      if (!value) {
        setCrop(undefined);
        setCompleted(null);
      }
      return;
    }

    // Largest centred box of this ratio that fits the displayed image.
    const { width: w, height: h } = el;
    let cw = w;
    let ch = cw / value;
    if (ch > h) {
      ch = h;
      cw = ch * value;
    }
    const next = {
      unit: "px" as const,
      x: (w - cw) / 2,
      y: (h - ch) / 2,
      width: cw,
      height: ch,
    };
    setCrop(next);
    setCompleted(next);
  };

  const reset = () => {
    setCrop(undefined);
    setCompleted(null);
    setAspect(1);
    setRotate(0);
    setFlipH(false);
    setFlipV(false);
  };

  const handleSave = async () => {
    if (!imgRef.current) return;
    setSaving(true);
    // Map the on-screen crop (display px) to natural px for the canvas.
    const el = imgRef.current;
    const scaleX = el.naturalWidth / el.width;
    const scaleY = el.naturalHeight / el.height;
    const natCrop: PixelCrop | null = completed
      ? {
          unit: "px",
          x: completed.x * scaleX,
          y: completed.y * scaleY,
          width: completed.width * scaleX,
          height: completed.height * scaleY,
        }
      : null;

    const t: Transform = { crop: natCrop, rotate, flipH, flipV };
    try {
      const blob = await renderEdited(el, t);
      await onSave(blob);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const btnBase = "h-9 rounded-lg border px-3 text-sm font-medium transition";
  const btn = `${btnBase} border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto"
    >
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        Edit image
      </h3>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-sm text-gray-500 dark:text-gray-400">Crop:</span>
        {ASPECTS.map((a) => (
          <button
            key={a.label}
            type="button"
            onClick={() => applyAspect(a.value)}
            aria-pressed={aspect === a.value}
            className={
              aspect === a.value
                ? `${btnBase} bg-brand-500 border-brand-500 text-white hover:bg-brand-600`
                : btn
            }
          >
            {a.label}
          </button>
        ))}
        <span className="w-px h-5 mx-1 bg-gray-200 dark:bg-gray-700" />
        <button
          type="button"
          className={
            rotate !== 0
              ? `${btnBase} bg-brand-500 border-brand-500 text-white hover:bg-brand-600`
              : btn
          }
          onClick={() => setRotate((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)}
        >
          Rotate {rotate === 0 ? "90°" : `${rotate}°`}
        </button>
        <button
          type="button"
          aria-pressed={flipH}
          className={
            flipH
              ? `${btnBase} bg-brand-500 border-brand-500 text-white hover:bg-brand-600`
              : btn
          }
          onClick={() => setFlipH((v) => !v)}
        >
          Flip H
        </button>
        <button
          type="button"
          aria-pressed={flipV}
          className={
            flipV
              ? `${btnBase} bg-brand-500 border-brand-500 text-white hover:bg-brand-600`
              : btn
          }
          onClick={() => setFlipV((v) => !v)}
        >
          Flip V
        </button>
      </div>

      <div className="relative flex items-center justify-center p-3 mb-4 bg-gray-100 rounded-lg dark:bg-gray-800 min-h-40">
        {!loaded && !loadError && (
          <div className="flex flex-col items-center gap-3 py-10">
            <span className="w-8 h-8 border-2 rounded-full animate-spin border-gray-300 border-t-brand-500" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Loading image…
            </span>
          </div>
        )}
        {loadError && (
          <p className="py-10 text-sm text-error-500">
            Could not load this image for editing.
          </p>
        )}
        <ReactCrop
          crop={crop}
          onChange={(c) => setCrop(c)}
          onComplete={(c) => setCompleted(c)}
          aspect={aspect}
          // Keep it mounted while loading so the ref is ready, just hidden.
          className={loaded ? "" : "hidden"}
        >
          <img
            ref={imgRef}
            src={src}
            alt="Edit preview"
            crossOrigin="anonymous"
            onLoad={() => {
              setLoaded(true);
              // Draw the default crop box now that dimensions are known.
              if (aspect) applyAspect(aspect);
            }}
            onError={() => setLoadError(true)}
            style={{
              maxHeight: "50vh",
              transform: `rotate(${rotate}deg) scaleX(${
                flipH ? -1 : 1
              }) scaleY(${flipV ? -1 : 1})`,
            }}
          />
        </ReactCrop>
      </div>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className={btn}>
          Cancel
        </button>
        {onSkip && (
          <button
            type="button"
            disabled={saving}
            className={btn}
            onClick={async () => {
              setSaving(true);
              try {
                await onSkip();
                reset();
                onClose();
              } finally {
                setSaving(false);
              }
            }}
          >
            {skipLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !loaded}
          className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>
    </Modal>
  );
}
