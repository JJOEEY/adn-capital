"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Trash2, ImagePlus, Eye, EyeOff, X } from "lucide-react";
import GuideMarkdown from "./GuideMarkdown";
import s from "./docs.module.css";

type Props = {
  isAdmin: boolean;
  sectionId: string;
  initialContent: string;
  published: boolean;
};

export default function AdminSectionTools({ isAdmin, sectionId, initialContent, published }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialContent);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!isAdmin) return null;

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/guide/sections/${sectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      setErr("Lưu thất bại.");
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async () => {
    setBusy(true);
    try {
      await fetch(`/api/guide/sections/${sectionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !published }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Xoá mục này?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guide/sections/${sectionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/hdsd");
      router.refresh();
    } catch {
      setErr("Xoá thất bại.");
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/guide/upload-image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error);
      setValue((v) => `${v}\n![${file.name}](${data.url})\n`);
    } catch {
      setErr("Upload ảnh thất bại (jpg/png/webp ≤ 5MB).");
    } finally {
      setUploading(false);
    }
  };

  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--hairline)",
    background: "var(--surface)",
    color: "var(--ink)",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {!editing ? (
          <button type="button" style={btn} onClick={() => setEditing(true)}>
            <Pencil size={13} /> Chỉnh sửa mục
          </button>
        ) : (
          <button
            type="button"
            style={{ ...btn, borderColor: "var(--moss)", color: "var(--moss)" }}
            onClick={() => {
              setEditing(false);
              setValue(initialContent);
            }}
          >
            <X size={13} /> Đóng
          </button>
        )}
        <button type="button" style={btn} onClick={() => void togglePublish()} disabled={busy}>
          {published ? <EyeOff size={13} /> : <Eye size={13} />}
          {published ? "Ẩn (nháp)" : "Xuất bản"}
        </button>
        <button
          type="button"
          style={{ ...btn, borderColor: "color-mix(in srgb, var(--down) 40%, transparent)", color: "var(--down)" }}
          onClick={() => void remove()}
          disabled={busy}
        >
          <Trash2 size={13} /> Xoá
        </button>
      </div>

      {err && (
        <p style={{ marginTop: 10, fontSize: 13, color: "var(--down)" }}>{err}</p>
      )}

      {editing && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
          className="hdsd-edit-grid"
        >
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 6 }}>Markdown</p>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{
                width: "100%",
                minHeight: 320,
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--hairline)",
                background: "var(--canvas)",
                color: "var(--ink)",
                fontSize: 13.5,
                lineHeight: 1.6,
                fontFamily: "var(--f-mono)",
                outline: "none",
              }}
            />
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...btn, cursor: "pointer" }}>
                <ImagePlus size={13} /> {uploading ? "Đang upload…" : "Chèn ảnh"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="dp-btn dp-btn-solid"
                style={{ height: 32, fontSize: 13 }}
                onClick={() => void save()}
                disabled={busy}
              >
                <Save size={13} /> Lưu
              </button>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-muted)", marginBottom: 6 }}>Xem trước</p>
            <div
              style={{
                padding: 14,
                borderRadius: 10,
                border: "1px solid var(--hairline)",
                background: "var(--canvas)",
                minHeight: 320,
              }}
            >
              <GuideMarkdown content={value || "_Nội dung trống._"} />
            </div>
          </div>
          <style>{`@media (max-width: 860px){ .hdsd-edit-grid{ grid-template-columns:1fr !important; } }`}</style>
        </div>
      )}
    </div>
  );
}
