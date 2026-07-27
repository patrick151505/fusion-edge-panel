import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`h-8 min-w-8 rounded px-1.5 text-sm leading-none transition disabled:opacity-40 ${
        active
          ? "bg-brand-500 text-white"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/[0.06]"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 mx-1 bg-gray-200 dark:bg-gray-700" />;
}

type BlockStyle = "paragraph" | "h1" | "h2" | "h3" | "h4" | "blockquote";

function currentStyle(editor: Editor): BlockStyle {
  for (const level of [1, 2, 3, 4] as const) {
    if (editor.isActive("heading", { level })) return `h${level}` as BlockStyle;
  }
  if (editor.isActive("blockquote")) return "blockquote";
  return "paragraph";
}

/** WordPress's "Paragraph" dropdown — the leftmost control on the first row. */
function StyleSelect({ editor }: { editor: Editor }) {
  const value = currentStyle(editor);

  const apply = (next: BlockStyle) => {
    if (next === value) return;
    const chain = editor.chain().focus();
    if (value === "blockquote") chain.toggleBlockquote();

    if (next === "paragraph") chain.setParagraph().run();
    else if (next === "blockquote") chain.setParagraph().toggleBlockquote().run();
    else {
      const level = Number(next.slice(1)) as 1 | 2 | 3 | 4;
      chain.setHeading({ level }).run();
    }
  };

  return (
    <select
      aria-label="Paragraph style"
      value={value}
      onChange={(e) => apply(e.target.value as BlockStyle)}
      className="h-8 rounded border border-gray-200 bg-transparent px-2 text-sm text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
    >
      <option value="paragraph">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="blockquote">Quote</option>
    </select>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Row 1 — the always-visible WordPress toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 pt-2 pb-1">
        <StyleSelect editor={editor} />
        <Divider />
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="Bulleted list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ☰
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          label="Blockquote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          ❝
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="Align left"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          ⇤
        </ToolbarButton>
        <ToolbarButton
          label="Align center"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          ⇔
        </ToolbarButton>
        <ToolbarButton
          label="Align right"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          ⇥
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="Insert/edit link"
          active={editor.isActive("link")}
          onClick={setLink}
        >
          🔗
        </ToolbarButton>
        <ToolbarButton
          label="Remove link"
          disabled={!editor.isActive("link")}
          onClick={() =>
            editor.chain().focus().extendMarkRange("link").unsetLink().run()
          }
        >
          ⛓️‍💥
        </ToolbarButton>
      </div>

      {/* Row 2 — WordPress's "kitchen sink" second row */}
      <div className="flex flex-wrap items-center gap-1 px-2 pt-1 pb-2">
        <ToolbarButton
          label="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          label="Justify"
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        >
          ▤
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="Horizontal line"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          ―
        </ToolbarButton>
        <ToolbarButton
          label="Clear formatting"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        >
          ⌫
        </ToolbarButton>
      </div>
    </div>
  );
}

export default function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: "tiptap-content min-h-[180px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Keep the editor in sync if the value is replaced from outside (e.g. reset).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden bg-white border border-gray-300 rounded-lg dark:border-gray-700 dark:bg-transparent">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
