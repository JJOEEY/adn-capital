"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { useCallback, useRef } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ImageIcon,
  Link as LinkIcon,
  Undo,
  Redo,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Quote,
  Minus,
  RemoveFormatting,
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder = "Nội dung bài viết..." }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Image.configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-4" },
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-cyan-400 underline hover:text-cyan-300", target: "_blank", rel: "noopener noreferrer" },
      }),
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none min-h-[300px] px-4 py-3 focus:outline-none text-slate-200 leading-relaxed",
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          event.preventDefault();
          Array.from(files).forEach((file) => {
            if (file.type.startsWith("image/")) {
              handleImageFile(file);
            }
          });
          return true;
        }
        return false;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (items) {
          for (const item of Array.from(items)) {
            if (item.type.startsWith("image/")) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) handleImageFile(file);
              return true;
            }
          }
        }
        return false;
      },
    },
  });

  const handleImageFile = useCallback(
    (file: File) => {
      if (!editor) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const src = e.target?.result as string;
        if (src) {
          editor.chain().focus().setImage({ src }).run();
        }
      };
      reader.readAsDataURL(file);
    },
    [editor]
  );

  const addImageFromUrl = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Nhập URL hình ảnh:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Nhập URL liên kết:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }, [editor]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        Array.from(files).forEach((file) => {
          if (file.type.startsWith("image/")) {
            handleImageFile(file);
          }
        });
      }
      e.target.value = "";
    },
    [handleImageFile]
  );

  if (!editor) return null;

  const ToolBtn = ({
    onClick,
    active,
    disabled,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active ? "bg-cyan-500/20 text-cyan-400" : "text-slate-400 hover:text-white hover:bg-white/10"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  const iconSize = "w-4 h-4";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-white/10 bg-white/[0.02]">
        {/* Undo/Redo */}
        <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Hoàn tác (Ctrl+Z)">
          <Undo className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Làm lại (Ctrl+Y)">
          <Redo className={iconSize} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Text formatting */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="In đậm (Ctrl+B)">
          <Bold className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="In nghiêng (Ctrl+I)">
          <Italic className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Gạch chân (Ctrl+U)">
          <UnderlineIcon className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Gạch ngang">
          <Strikethrough className={iconSize} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Headings */}
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Tiêu đề H2">
          <Heading2 className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Tiêu đề H3">
          <Heading3 className={iconSize} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Lists */}
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Danh sách">
          <List className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Danh sách đánh số">
          <ListOrdered className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Trích dẫn">
          <Quote className={iconSize} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Alignment */}
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Căn trái">
          <AlignLeft className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Căn giữa">
          <AlignCenter className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Căn phải">
          <AlignRight className={iconSize} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Media */}
        <ToolBtn onClick={() => fileInputRef.current?.click()} title="Tải ảnh lên">
          <ImageIcon className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={addImageFromUrl} title="Chèn ảnh từ URL">
          <ImageIcon className={`${iconSize} opacity-60`} />
        </ToolBtn>
        <ToolBtn onClick={addLink} active={editor.isActive("link")} title="Chèn liên kết">
          <LinkIcon className={iconSize} />
        </ToolBtn>

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Misc */}
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Đường kẻ ngang">
          <Minus className={iconSize} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Xóa định dạng">
          <RemoveFormatting className={iconSize} />
        </ToolBtn>
      </div>

      {/* ── Editor area ── */}
      <EditorContent editor={editor} />

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* ── Hint ── */}
      <div className="px-3 py-1.5 border-t border-white/5 text-[11px] text-slate-500">
        Hỗ trợ: Copy-paste hình ảnh trực tiếp · Kéo-thả file ảnh · Ctrl+B/I/U · Markdown shortcuts
      </div>
    </div>
  );
}
