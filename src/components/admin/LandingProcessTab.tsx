"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Edit3, ImageUp, RefreshCw, Save, Trash2, X } from "lucide-react";
import type { LandingProcessStep } from "@/types";

interface ProcessFormState {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  isPublished: boolean;
  sortOrder: string;
}

const EMPTY_FORM: ProcessFormState = {
  title: "",
  description: "",
  imageUrl: "",
  imageAlt: "",
  isPublished: true,
  sortOrder: "0",
};

export function LandingProcessTab() {
  const [steps, setSteps] = useState<LandingProcessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProcessFormState>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/landing-process-steps");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { steps: LandingProcessStep[] };
      setSteps(data.steps ?? []);
    } catch {
      setError("Không thể tải danh sách bước quy trình.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSteps();
  }, [fetchSteps]);

  function startCreate() {
    const nextSort = steps.length > 0 ? Math.max(...steps.map((step) => step.sortOrder)) + 1 : 1;
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      sortOrder: String(nextSort),
      isPublished: true,
    });
  }

  function startEdit(step: LandingProcessStep) {
    setEditingId(step.id);
    setForm({
      title: step.title,
      description: step.description,
      imageUrl: step.imageUrl,
      imageAlt: step.imageAlt ?? "",
      isPublished: step.isPublished,
      sortOrder: String(step.sortOrder),
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function submitForm() {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      imageUrl: form.imageUrl.trim(),
      imageAlt: form.imageAlt.trim() || null,
      isPublished: form.isPublished,
      sortOrder: Number(form.sortOrder) || 0,
    };

    setSaving(true);
    setError("");
    try {
      const endpoint = editingId
        ? `/api/admin/landing-process-steps/${editingId}`
        : "/api/admin/landing-process-steps";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Lưu thất bại");
      }
      await fetchSteps();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const yes = window.confirm("Xóa bước quy trình này?");
    if (!yes) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/landing-process-steps/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchSteps();
      if (editingId === id) resetForm();
    } catch {
      setError("Xóa bước quy trình thất bại.");
    } finally {
      setSaving(false);
    }
  }

  async function quickTogglePublish(step: LandingProcessStep) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/landing-process-steps/${step.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !step.isPublished }),
      });
      if (!res.ok) throw new Error();
      await fetchSteps();
    } catch {
      setError("Không thể cập nhật trạng thái publish.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadImage(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/guide/upload-image", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Upload ảnh thất bại");
      }
      const uploadedUrl = data.url;
      setForm((prev) => ({ ...prev, imageUrl: uploadedUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload ảnh thất bại");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
            Landing Process Steps
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            {steps.length} bước cấu hình
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void fetchSteps()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer"
            style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
          <button
            onClick={startCreate}
            className="px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer"
            style={{ background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.25)", color: "#16a34a" }}
          >
            Tạo bước mới
          </button>
        </div>
      </div>

      {(editingId !== null || form.title || form.description || form.imageUrl) && (
        <div className="rounded-xl border p-4 sm:p-5 space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {editingId ? "Sửa bước" : "Tạo bước mới"}
            </p>
            <button
              onClick={resetForm}
              className="p-1 rounded-md cursor-pointer"
              style={{ color: "var(--text-muted)" }}
              title="Hủy"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Tiêu đề bước"
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <input
              value={form.sortOrder}
              onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
              placeholder="Sort order"
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <input
              value={form.imageUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, imageUrl: e.target.value }))}
              placeholder="URL ảnh"
              className="px-3 py-2 rounded-lg text-sm md:col-span-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <input
              value={form.imageAlt}
              onChange={(e) => setForm((prev) => ({ ...prev, imageAlt: e.target.value }))}
              placeholder="ALT ảnh"
              className="px-3 py-2 rounded-lg text-sm md:col-span-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
          </div>

          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Mô tả bước"
            rows={4}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUploadImage(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
              style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              <ImageUp className="w-3.5 h-3.5" />
              {uploading ? "Đang upload..." : "Upload ảnh (HDSD API)"}
            </button>

            <label className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((prev) => ({ ...prev, isPublished: e.target.checked }))}
              />
              Publish bước này
            </label>

            <button
              onClick={() => void submitForm()}
              disabled={saving || uploading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer disabled:opacity-60"
              style={{ background: "rgba(22,163,74,0.10)", borderColor: "rgba(22,163,74,0.25)", color: "#16a34a" }}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Đang lưu..." : editingId ? "Cập nhật" : "Tạo mới"}
            </button>
          </div>

          {form.imageUrl && (
            <div
              className="rounded-lg border p-2 w-full max-w-xs"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            >
              <img src={form.imageUrl} alt={form.imageAlt || "Preview"} className="w-full h-auto rounded-md object-contain" />
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      ) : steps.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>
          Chưa có bước quy trình nào. Bấm &quot;Tạo bước mới&quot; để bắt đầu.
        </p>
      ) : (
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.id} className="border rounded-xl p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                    {step.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    sort: {step.sortOrder} · {step.isPublished ? "Published" : "Draft"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => void quickTogglePublish(step)}
                    className="px-2 py-1 rounded text-[11px] font-bold cursor-pointer"
                    style={{
                      background: step.isPublished ? "rgba(22,163,74,0.12)" : "rgba(245,158,11,0.15)",
                      color: step.isPublished ? "#16a34a" : "#f59e0b",
                    }}
                  >
                    {step.isPublished ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    onClick={() => startEdit(step)}
                    className="p-1.5 rounded-md cursor-pointer"
                    style={{ color: "var(--text-muted)" }}
                    title="Sửa"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => void handleDelete(step.id)}
                    className="p-1.5 rounded-md cursor-pointer"
                    style={{ color: "var(--danger)" }}
                    title="Xóa"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
