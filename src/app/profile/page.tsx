"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import {
  Calendar,
  Clock,
  Crown,
  Shield,
  ShieldCheck,
  Edit3,
  Save,
  X,
  Camera,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Upload,
  Link as LinkIcon,
  Brain,
} from "lucide-react";
import Link from "next/link";

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status, update: updateSession } = useSession();
  const { dbUser, role, vipTier, isAuthenticated, isAdmin, isVip, isLoading } =
    useCurrentDbUser();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarMode, setAvatarMode] = useState<"upload" | "url">("upload");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [enableAIReview, setEnableAIReview] = useState(true);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  // Sync enableAIReview from dbUser
  useEffect(() => {
    if (dbUser) {
      setEnableAIReview(dbUser.enableAIReview ?? true);
    }
  }, [dbUser]);

  const handleToggleAIReview = async () => {
    setAiReviewLoading(true);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enableAIReview: !enableAIReview }),
      });
      if (res.ok) {
        setEnableAIReview(!enableAIReview);
        setMsg({ type: "ok", text: !enableAIReview ? "Đã bật đánh giá AI hàng tuần" : "Đã tắt đánh giá AI hàng tuần" });
      }
    } catch {
      setMsg({ type: "err", text: "Lỗi cập nhật cài đặt" });
    } finally {
      setAiReviewLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && status !== "loading" && !isAuthenticated) {
      router.replace("/auth");
    }
  }, [isLoading, status, isAuthenticated, router]);

  useEffect(() => {
    if (dbUser) {
      setNameValue(dbUser.name ?? "");
      setAvatarUrl(dbUser.image ?? "");
    }
  }, [dbUser]);

  // Load AI Review setting
  useEffect(() => {
    if (isAuthenticated) {
      fetch("/api/user/settings")
        .then((r) => r.json())
        .then((d) => {
          if (typeof d.enableAIReview === "boolean") setEnableAIReview(d.enableAIReview);
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);

  const save = async (data: { name?: string; image?: string }) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Lỗi cập nhật");
      }
      setMsg({ type: "ok", text: "Cập nhật thành công!" });
      // Refresh session so navbar updates
      await updateSession();
      // Small delay then reload user data
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Lỗi" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveName = () => {
    if (!nameValue.trim()) return;
    setEditingName(false);
    save({ name: nameValue.trim() });
  };

  const handleSaveAvatar = () => {
    setEditingAvatar(false);
    save({ image: avatarUrl });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: "err", text: "File quá lớn (tối đa 2MB)" });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      setMsg({ type: "err", text: "Chỉ chấp nhận JPG, PNG, WebP, GIF" });
      return;
    }
    setSelectedFile(file);
    setPreviewFile(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setMsg(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Lỗi upload");
      }
      setMsg({ type: "ok", text: "Cập nhật avatar thành công!" });
      setEditingAvatar(false);
      setSelectedFile(null);
      setPreviewFile(null);
      await updateSession();
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Lỗi" });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || status === "loading") {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-muted)" }} />
        </div>
      </MainLayout>
    );
  }

  if (!dbUser) return null;

  // Derived data
  const displayName = dbUser.name ?? dbUser.email?.split("@")[0] ?? "User";
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isExpired =
    !isAdmin &&
    role === "FREE" &&
    !isVip;

  const vipUntilDate = dbUser.vipUntil
    ? new Date(dbUser.vipUntil)
    : null;
  const daysLeft = vipUntilDate
    ? Math.ceil((vipUntilDate.getTime() - Date.now()) / 86400000)
    : null;

  const roleLabel =
    isAdmin
      ? "ADMIN"
      : role === "VIP"
      ? vipTier === "PREMIUM"
        ? "PREMIUM"
        : "VIP"
      : "FREE";

  const roleStyle: React.CSSProperties =
    isAdmin
      ? { color: "#10b981", background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.20)" }
      : role === "VIP"
      ? vipTier === "PREMIUM"
        ? { color: "#f59e0b", background: "rgba(245,158,11,0.10)", borderColor: "rgba(245,158,11,0.20)" }
        : { color: "#a855f7", background: "rgba(168,85,247,0.10)", borderColor: "rgba(168,85,247,0.20)" }
      : { color: "var(--text-muted)", background: "rgba(115,115,115,0.10)", borderColor: "rgba(115,115,115,0.20)" };

  return (
    <MainLayout>
      <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* ── Header Card ── */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar */}
            <div className="relative group">
              {dbUser.image ? (
                <img
                  src={dbUser.image}
                  alt="Avatar"
                  className="w-20 h-20 rounded-2xl border-2 object-cover" style={{ borderColor: "var(--border)" }}
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl border-2 flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.30)" }}>
                  <span className="text-xl font-black" style={{ color: "#10b981" }}>
                    {initials}
                  </span>
                </div>
              )}
              <button
                onClick={() => setEditingAvatar(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg border flex items-center justify-center transition-colors cursor-pointer"
                style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}
                title="Đổi avatar"
              >
                <Camera className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>

            {/* Name + Email */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                {editingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      ref={nameRef}
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                      className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none w-48"
                      style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                      maxLength={100}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving}
                      className="p-1.5 rounded-lg transition-colors cursor-pointer"
                      style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNameValue(dbUser.name ?? "");
                      }}
                      className="p-1.5 rounded-lg transition-colors cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{displayName}</h1>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 rounded-md transition-colors cursor-pointer"
                      style={{ color: "var(--text-muted)" }}
                      title="Đổi tên hiển thị"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{dbUser.email}</p>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[12px] font-bold"
                  style={roleStyle}
                >
                  {isAdmin ? (
                    <ShieldCheck className="w-2.5 h-2.5" />
                  ) : role === "VIP" ? (
                    <Crown className="w-2.5 h-2.5" />
                  ) : (
                    <Shield className="w-2.5 h-2.5" />
                  )}
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Avatar edit panel */}
          {editingAvatar && (
            <div className="mt-4 p-4 rounded-xl border space-y-4" style={{ background: "var(--surface-2)", borderColor: "var(--border)" }}>
              {/* Tabs: Upload / URL */}
              <div className="flex gap-1 bg-[var(--surface)] rounded-lg p-0.5">
                <button
                  onClick={() => setAvatarMode("upload")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer"
                  style={avatarMode === "upload" ? { background: "rgba(16,185,129,0.15)", color: "#10b981" } : { color: "var(--text-muted)" }}
                >
                  <Upload className="w-3 h-3" />
                  Tải lên
                </button>
                <button
                  onClick={() => setAvatarMode("url")}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer"
                  style={avatarMode === "url" ? { background: "rgba(16,185,129,0.15)", color: "#10b981" } : { color: "var(--text-muted)" }}
                >
                  <LinkIcon className="w-3 h-3" />
                  Nhập URL
                </button>
              </div>

              {avatarMode === "upload" ? (
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {previewFile ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={previewFile}
                        alt="Preview"
                        className="w-16 h-16 rounded-xl border object-cover" style={{ borderColor: "var(--border)" }}
                      />
                      <div className="flex-1">
                        <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{selectedFile?.name}</p>
                        <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{selectedFile ? (selectedFile.size / 1024).toFixed(0) + " KB" : ""}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full py-6 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-colors cursor-pointer" style={{ borderColor: "var(--border)" }}
                    >
                      <Upload className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>Chọn ảnh từ máy tính</span>
                      <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>JPG, PNG, WebP, GIF — tối đa 2MB</span>
                    </button>
                  )}
                  <div className="flex gap-2">
                    {previewFile ? (
                      <>
                        <button
                          onClick={handleUploadAvatar}
                          disabled={uploading}
                          className="px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                        >
                          {uploading ? "Đang tải..." : "Lưu Avatar"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewFile(null);
                          }}
                          className="px-4 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
                        >
                          Chọn lại
                        </button>
                      </>
                    ) : null}
                    <button
                      onClick={() => {
                        setEditingAvatar(false);
                        setSelectedFile(null);
                        setPreviewFile(null);
                      }}
                      className={`px-4 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-xs font-bold hover:border-neutral-600 transition-colors cursor-pointer ${previewFile ? "" : ""}`}
                    >
                      Hủy
                    </button>
                    {dbUser.image && (
                      <button
                        onClick={() => {
                          setAvatarUrl("");
                          setEditingAvatar(false);
                          setSelectedFile(null);
                          setPreviewFile(null);
                          save({ image: "" });
                        }}
                        className="px-4 py-2 rounded-lg text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors cursor-pointer ml-auto"
                      >
                        Xóa avatar
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveAvatar}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer"
                    >
                      {saving ? "Đang lưu..." : "Lưu Avatar"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingAvatar(false);
                        setAvatarUrl(dbUser.image ?? "");
                      }}
                      className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-xs font-bold hover:border-neutral-600 transition-colors cursor-pointer"
                    >
                      Hủy
                    </button>
                    {dbUser.image && (
                      <button
                        onClick={() => {
                          setAvatarUrl("");
                          setEditingAvatar(false);
                          save({ image: "" });
                        }}
                        className="px-4 py-2 rounded-lg text-red-400 text-xs font-bold hover:bg-red-500/10 transition-colors cursor-pointer ml-auto"
                      >
                        Xóa avatar
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Info Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ngày hết hạn */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Ngày hết hạn
              </span>
            </div>
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {isAdmin
                ? "Không giới hạn"
                : vipUntilDate
                ? vipUntilDate.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })
                : "N/A"}
            </p>
          </div>

          {/* Trạng thái */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Trạng thái
              </span>
            </div>
            {isAdmin ? (
              <p className="text-lg font-bold" style={{ color: "#10b981" }}>ADMIN</p>
            ) : isVip ? (
              <div>
                <p className="text-lg font-bold" style={{ color: "#a855f7" }}>
                  {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                </p>
                {daysLeft !== null && daysLeft > 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    Còn {daysLeft} ngày
                  </p>
                )}
              </div>
            ) : (
              <p className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>FREE</p>
            )}
          </div>

          {/* Gói dịch vụ */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                Gói dịch vụ
              </span>
            </div>
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
              {isAdmin
                ? "Admin – Toàn quyền"
                : isVip
                ? `ADN - ${vipTier === "PREMIUM" ? "Premium" : "VIP"}`
                : "ADN - Free"}
            </p>
          </div>
        </div>

        {/* ── Cài đặt Nhật Ký & AI Review ── */}
        {(isVip || isAdmin) && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4" style={{ color: "#a855f7" }} />
              <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
                Cài đặt Nhật Ký & AI
              </span>
            </div>

            {/* Toggle AI Review */}
            <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Nhận đánh giá tâm lý hàng tuần từ ADN AI
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  AI sẽ phân tích giao dịch tuần và gửi nhận xét riêng tư vào 17h Thứ 6
                </p>
              </div>
              <button
                onClick={handleToggleAIReview}
                disabled={aiReviewLoading}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${
                  enableAIReview ? "bg-emerald-500" : "bg-neutral-700"
                } ${aiReviewLoading ? "opacity-50" : ""}`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    enableAIReview ? "translate-x-5.5 left-0.5" : "left-0.5"
                  }`}
                  style={{ transform: enableAIReview ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          </div>
        )}

        {/* ── Expired Banner ── */}
        {isExpired && (
          <Link href="/pricing">
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 flex items-start gap-3 cursor-pointer hover:bg-red-500/10 transition-colors">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-400">
                  Tài khoản đã hết hạn
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Tài khoản của bạn đã hết hạn,{" "}
                  <span className="text-red-400 underline font-semibold">
                    click vào đây
                  </span>{" "}
                  để gia hạn dịch vụ.
                </p>
              </div>
            </div>
          </Link>
        )}

        {/* ── Success/Error message ── */}
        {msg && (
          <div
            className={`rounded-xl p-3 text-xs font-medium flex items-center gap-2 ${
              msg.type === "ok"
                ? "border"
                : "border"
            }`}
            style={msg.type === "ok"
              ? { background: "rgba(16,185,129,0.10)", color: "#10b981", borderColor: "rgba(16,185,129,0.20)" }
              : { background: "rgba(239,68,68,0.10)", color: "var(--danger)", borderColor: "rgba(239,68,68,0.20)" }
            }
          >
            {msg.type === "ok" ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
            {msg.text}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
