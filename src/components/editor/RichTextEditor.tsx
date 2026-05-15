"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadEndpoint?: string;
  onImageUploaded?: (url: string) => void;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  children,
  label,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarSelect({
  disabled,
  label,
  value,
  onChange,
  options,
}: {
  disabled?: boolean;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-slate-300">
      <span className="sr-only">{label}</span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-[130px] bg-transparent text-xs font-semibold text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-40"
        title={label}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950 text-slate-100">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Viết nội dung bài viết...",
  uploadEndpoint = "/api/articles/upload-image",
  onImageUploaded,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

      setUploading(true);
      setUploadError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) {
          throw new Error(data?.error || "Không thể tải ảnh lên máy chủ");
        }

        editorRef.current?.chain().focus().setImage({ src: data.url, alt: file.name }).run();
        onImageUploaded?.(data.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể tải ảnh lên";
        setUploadError(message);
        throw error;
      } finally {
        setUploading(false);
      }
    },
    [onImageUploaded, uploadEndpoint],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-emerald-300 underline underline-offset-2",
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "my-4 h-auto max-w-full rounded-xl border border-white/10",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[420px] px-4 py-4 text-base leading-relaxed text-slate-100 focus:outline-none prose-p:my-3 prose-headings:text-white prose-headings:font-black prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-strong:text-white prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-6 prose-ol:pl-6 prose-li:my-1 prose-blockquote:border-emerald-400/40 prose-blockquote:text-slate-200",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) return false;

        event.preventDefault();
        for (const file of files) {
          void uploadImage(file).catch((error) => {
            console.error("[RichTextEditor] Image paste upload failed:", error);
          });
        }
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length === 0) return false;

        event.preventDefault();
        for (const file of files) {
          void uploadImage(file).catch((error) => {
            console.error("[RichTextEditor] Image drop upload failed:", error);
          });
        }
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.getHTML() === content) return;
    editor.commands.setContent(content || "");
  }, [content, editor]);

  const addLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Nhập URL liên kết", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const blockValue =
    editor?.isActive("heading", { level: 1 })
      ? "h1"
      : editor?.isActive("heading", { level: 2 })
        ? "h2"
        : editor?.isActive("heading", { level: 3 })
          ? "h3"
          : "paragraph";

  const alignValue =
    editor?.isActive({ textAlign: "center" })
      ? "center"
      : editor?.isActive({ textAlign: "right" })
        ? "right"
        : editor?.isActive({ textAlign: "justify" })
          ? "justify"
          : "left";

  const setBlock = (value: string) => {
    if (!editor) return;
    if (value === "h1") editor.chain().focus().toggleHeading({ level: 1 }).run();
    if (value === "h2") editor.chain().focus().toggleHeading({ level: 2 }).run();
    if (value === "h3") editor.chain().focus().toggleHeading({ level: 3 }).run();
    if (value === "paragraph") editor.chain().focus().setParagraph().run();
  };

  const setAlign = (value: string) => {
    if (!editor) return;
    editor.chain().focus().setTextAlign(value).run();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
        <ToolbarSelect
          label="Kiểu đoạn"
          disabled={!editor}
          value={blockValue}
          onChange={setBlock}
          options={[
            { value: "paragraph", label: "Đoạn văn" },
            { value: "h1", label: "Tiêu đề lớn" },
            { value: "h2", label: "Tiêu đề mục" },
            { value: "h3", label: "Tiêu đề nhỏ" },
          ]}
        />
        <ToolbarButton
          label="In đậm"
          disabled={!editor}
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="In nghiêng"
          disabled={!editor}
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Gạch chân"
          disabled={!editor}
          active={editor?.isActive("underline")}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Tiêu đề"
          disabled={!editor}
          active={editor?.isActive("heading", { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách"
          disabled={!editor}
          active={editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Danh sách số"
          disabled={!editor}
          active={editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Trích dẫn"
          disabled={!editor}
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarSelect
          label="Căn lề"
          disabled={!editor}
          value={alignValue}
          onChange={setAlign}
          options={[
            { value: "left", label: "Căn trái" },
            { value: "center", label: "Căn giữa" },
            { value: "right", label: "Căn phải" },
            { value: "justify", label: "Căn đều" },
          ]}
        />
        <ToolbarButton
          label="Căn trái"
          disabled={!editor}
          active={editor?.isActive({ textAlign: "left" })}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Căn giữa"
          disabled={!editor}
          active={editor?.isActive({ textAlign: "center" })}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Căn phải"
          disabled={!editor}
          active={editor?.isActive({ textAlign: "right" })}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Căn đều"
          disabled={!editor}
          active={editor?.isActive({ textAlign: "justify" })}
          onClick={() => editor?.chain().focus().setTextAlign("justify").run()}
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Gắn liên kết" disabled={!editor} active={editor?.isActive("link")} onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Thêm ảnh"
          disabled={!editor || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </ToolbarButton>
        <ToolbarButton
          label="Hoàn tác"
          disabled={!editor || !editor.can().undo()}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Làm lại"
          disabled={!editor || !editor.can().redo()}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) {
              void uploadImage(file).catch((error) => {
                console.error("[RichTextEditor] Image upload failed:", error);
              });
            }
          }}
        />
      </div>
      <EditorContent editor={editor} />
      <div className="border-t border-white/10 px-3 py-2 text-xs text-slate-400">
        Có thể dán ảnh trực tiếp, kéo thả ảnh hoặc bấm nút thêm ảnh. Ảnh sẽ được tải lên máy chủ trước khi chèn vào bài.
      </div>
      {uploadError && (
        <div className="border-t border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {uploadError}
        </div>
      )}
    </div>
  );
}
