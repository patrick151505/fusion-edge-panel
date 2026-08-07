import { useState } from "react";
import "@google/model-viewer";

// <model-viewer> is a custom element; declare it so TSX/JSX accepts it.
// React 19's automatic runtime resolves intrinsic elements from React.JSX.
type ModelViewerProps = React.DetailedHTMLProps<
  React.HTMLAttributes<HTMLElement> & {
    src?: string;
    alt?: string;
    "camera-controls"?: boolean | "";
    "auto-rotate"?: boolean | "";
    "shadow-intensity"?: string | number;
    exposure?: string | number;
    ar?: boolean | "";
  },
  HTMLElement
>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerProps;
    }
  }
}

type Props = {
  src: string;
  /** Viewer height (Tailwind class value). */
  className?: string;
  /** Enable AR button on supported mobile devices. */
  ar?: boolean;
};

/** Read-only interactive 3D viewer for a glTF/GLB model. */
export default function Model3DViewer({ src, className, ar }: Props) {
  const [failed, setFailed] = useState(false);

  const box =
    "overflow-hidden border border-gray-200 rounded-xl bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]";

  if (failed) {
    return (
      <div className={`${box} flex items-center justify-center h-72 px-4 text-center`}>
        <span className="text-sm text-error-500">
          Couldn’t load the 3D model.
        </span>
      </div>
    );
  }

  return (
    <div className={box}>
      <model-viewer
        key={src}
        src={src}
        alt="Interactive 3D model"
        camera-controls
        auto-rotate
        shadow-intensity="1"
        exposure="1"
        {...(ar ? { ar: true } : {})}
        style={{ width: "100%", height: "18rem" }}
        className={className}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
