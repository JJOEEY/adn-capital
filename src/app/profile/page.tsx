"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";
import {
  UserCircle,
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
          <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
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
    role === "ADMIN"
      ? "ADMIN"
      : role === "VIP"
      ? vipTier === "PREMIUM"
        ? "PREMIUM"
        : "VIP"
      : "FREE";

  const roleColor =
    role === "ADMIN"
      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      : role === "VIP"
      ? vipTier === "PREMIUM"
        ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
        : "text-purple-400 bg-purple-500/10 border-purple-500/20"
      : "text-neutral-400 bg-neutral-500/10 border-neutral-500/20";

  return (
    <MainLayout>
      <div className="p-3 md:p-6 max-w-2xl mx-auto space-y-6">
        {/* ── Header Card ── */}
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Avatar */}
            <div className="relative group">
              {dbUser.image ? (
                <img
                  src={dbUser.image}
                  alt="Avatar"
                  className="w-20 h-20 rounded-2xl border-2 border-neutral-700 object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center">
                  <span className="text-xl font-black text-emerald-400">
                    {initials}
                  </span>
                </div>
              )}
              <button
                onClick={() => setEditingAvatar(true)}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-neutral-700 transition-colors cursor-pointer"
                title="Đổi avatar"
              >
                <Camera className="w-3.5 h-3.5 text-neutral-400" />
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
                      className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500/50 w-48"
                      maxLength={100}
                    />
                    <button
                      onClick={handleSaveName}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setNameValue(dbUser.name ?? "");
                      }}
                      className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-500 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-lg font-bold text-white">{displayName}</h1>
                    <button
                      onClick={() => setEditingName(true)}
                      className="p-1 rounded-md hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer"
                      title="Đổi tên hiển thị"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-sm text-neutral-500 mt-0.5">{dbUser.email}</p>
              <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${roleColor}`}
                >
                  {role === "ADMIN" ? (
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
            <div className="mt-4 p-4 bg-neutral-800/60 rounded-xl border border-neutral-700 space-y-4">
              {/* Tabs: Upload / URL */}
              <div className="flex gap-1 bg-neutral-900 rounded-lg p-0.5">
                <button
                  onClick={() => setAvatarMode("upload")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    avatarMode === "upload"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  Tải lên
                </button>
                <button
                  onClick={() => setAvatarMode("url")}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    avatarMode === "url"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "text-neutral-500 hover:text-neutral-300"
                  }`}
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
                        className="w-16 h-16 rounded-xl border border-neutral-700 object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-xs text-neutral-400 truncate">{selectedFile?.name}</p>
                        <p className="text-[10px] text-neutral-600">{selectedFile ? (selectedFile.size / 1024).toFixed(0) + " KB" : ""}</p>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full py-6 rounded-xl border-2 border-dashed border-neutral-700 hover:border-emerald-500/30 flex flex-col items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Upload className="w-6 h-6 text-neutral-600" />
                      <span className="text-xs text-neutral-500">Chọn ảnh từ máy tính</span>
                      <span className="text-[10px] text-neutral-600">JPG, PNG, WebP, GIF — tối đa 2MB</span>
                    </button>
                  )}
                  <div className="flex gap-2">
                    {previewFile ? (
                      <>
                        <button
                          onClick={handleUploadAvatar}
                          disabled={uploading}
                          className="px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold hover:bg-emerald-500/25 transition-colors cursor-pointer"
                        >
                          {uploading ? "Đang tải..." : "Lưu Avatar"}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            setPreviewFile(null);
                          }}
                          className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-400 text-xs font-bold hover:border-neutral-600 transition-colors cursor-pointer"
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
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 placeholder-neutral-600"
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
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-bold text-neutral-500">
                Ngày hết hạn
              </span>
            </div>
            <p className="text-lg font-bold text-white">
              {role === "ADMIN"
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
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-bold text-neutral-500">
                Trạng thái
              </span>
            </div>
            {role === "ADMIN" ? (
              <p className="text-lg font-bold text-emerald-400">ADMIN</p>
            ) : isVip ? (
              <div>
                <p className="text-lg font-bold text-purple-400">
                  {vipTier === "PREMIUM" ? "PREMIUM" : "VIP"}
                </p>
                {daysLeft !== null && daysLeft > 0 && (
                  <p className="text-xs text-neutral-500 mt-1">
                    Còn {daysLeft} ngày
                  </p>
                )}
              </div>
            ) : (
              <p className="text-lg font-bold text-neutral-400">FREE</p>
            )}
          </div>

          {/* Gói dịch vụ */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-bold text-neutral-500">
                Gói dịch vụ
              </span>
            </div>
            <p className="text-lg font-bold text-white">
              {role === "ADMIN"
                ? "Admin – Toàn quyền"
                : isVip
                ? `RS - ${vipTier === "PREMIUM" ? "Premium" : "VIP"}`
                : "RS - Free"}
            </p>
          </div>
        </div>

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
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
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
