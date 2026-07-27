import { useMemo } from "react";
import DOMPurify from "dompurify";

// Reduce every surviving `style` attribute to a single, safe text-align rule.
// DOMPurify does NOT sanitize CSS inside a plainly-allowed `style` attribute,
// so we never allow it wholesale — we rebuild it from a strict whitelist. This
// keeps the editor's alignment while dropping url()/expression()/behavior XSS.
const ALIGN = new Set(["left", "center", "right", "justify"]);
let hookInstalled = false;

function installStyleHook() {
  if (hookInstalled) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const el = node as Element;
    if (!el.getAttribute) return;
    const style = el.getAttribute("style");
    if (style === null) return;
    const match = /text-align:\s*(left|center|right|justify)/i.exec(style);
    if (match && ALIGN.has(match[1].toLowerCase())) {
      el.setAttribute("style", `text-align:${match[1].toLowerCase()}`);
    } else {
      el.removeAttribute("style");
    }
  });
  hookInstalled = true;
}

/**
 * Renders admin-authored HTML. Even trusted authors are sanitized on the way
 * out — stored content is untrusted at render time (a stored-XSS payload in
 * the DB must never execute in another user's browser).
 */
export default function RichText({
  html,
  className = "",
}: {
  html: string;
  className?: string;
}) {
  const clean = useMemo(() => {
    installStyleHook();
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      ADD_ATTR: ["target", "rel", "style"],
    });
  }, [html]);

  return (
    <div
      className={`tiptap-content ${className}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
