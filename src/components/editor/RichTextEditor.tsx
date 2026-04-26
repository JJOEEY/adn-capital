"use client";

import { useCallback, useEffect, useRef } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
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
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-2 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-blue-400/40 bg-blue-500/20 text-blue-200"
          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({
  content,
  onChange,
  placeholder = "Nội dung bài viết...",
  uploadEndpoint = "/api/articles/upload-image",
  onImageUploaded,
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<Editor | null>(null);

  const uploadImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) return;

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
    },
    [onImageUploaded, uploadEndpoint]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "text-blue-400 underline underline-offset-2",
          rel: "noopener noreferrer nofollow",
          target: "_blank",
        },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "my-4 h-auto max-w-full rounded-lg",
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
          "prose prose-invert max-w-none min-h-[320px] px-4 py-3 text-sm text-slate-200 focus:outline-none",
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
          file.type.startsWith("image/")
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
          file.type.startsWith("image/")
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
    const url = window.prompt("URL liên kết", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-2">
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
        <ToolbarButton label="Liên kết" disabled={!editor} active={editor?.isActive("link")} onClick={addLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Tải ảnh"
          disabled={!editor}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
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
      <div className="border-t border-white/10 px-3 py-2 text-[11px] text-slate-500">
        Có thể dán trực tiếp hình ảnh hoặc kéo thả file ảnh. Ảnh sẽ được upload lên máy chủ,
        không nhúng base64 vào bài viết.
      </div>
    </div>
  );
}
