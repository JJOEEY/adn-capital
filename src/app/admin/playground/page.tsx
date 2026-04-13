"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Eye, EyeOff, Zap, Database, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_PLAYGROUND_PASS ?? "adncapital2025";

type Status = "idle" | "loading" | "success" | "error";

// ── Premium Toggle Switch ─────────────────────────────────────────
function ToggleSwitch({ enabled, onChange, loading }: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={() => !loading && onChange(!enabled)}
      className={`relative w-16 h-8 rounded-full flex items-center px-1 transition-all duration-500 focus:outline-none ${
        enabled
          ? "bg-gradient-to-r from-yellow-500 to-orange-500 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
          : "border"
      }`}
      style={!enabled ? { background: "var(--surface-2)", borderColor: "var(--border)" } : {}}
    >
      <motion.div
        animate={{ x: enabled ? 32 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : enabled ? (
          <Zap className="w-3 h-3" style={{ color: "#eab308" }} />
        ) : (
          <Database className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
        )}
      </motion.div>
    </button>
  );
}

// ── Toast Notification ────────────────────────────────────────────
function Toast({ type, message }: { type: "success" | "error"; message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.95 }}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold"
      style={
        type === "success"
          ? { background: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.30)", color: "#10b981" }
          : { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.30)", color: "var(--danger)" }
      }
    >
      {type === "success" ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      {message}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function AdminPlaygroundPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [showPw, setShowPw]     = useState(false);
  const [pw, setPw]             = useState("");
  const [pwError, setPwError]   = useState(false);
  const [mockMode, setMockMode] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<Status>("idle");
  const [toast, setToast]       = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Load current setting on unlock
  useEffect(() => {
    if (!unlocked) return;
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => { if (d.IS_MOCK_MODE !== undefined) setMockMode(d.IS_MOCK_MODE); })
      .catch(() => {});
  }, [unlocked]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const handleUnlock = () => {
    if (pw === ADMIN_PASSWORD) { setUnlocked(true); setPwError(false); }
    else { setPwError(true); setPw(""); }
  };

  const handleToggle = async (newVal: boolean) => {
    setLoading(true);
    setStatus("loading");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "IS_MOCK_MODE", value: newVal ? "true" : "false" }),
      });
      if (!res.ok) throw new Error("Forbidden");
      setMockMode(newVal);
      setStatus("success");
      showToast("success", newVal
        ? "🎬 Chế độ trình diễn đã BẬT — Hệ thống dùng Mock Data"
        : "✅ Về Real Data — Kết nối FiinQuant thật"
      );
    } catch {
      setStatus("error");
      showToast("error", "Lỗi! Kiểm tra lại quyền Admin.");
    } finally {
      setLoading(false);
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  // ── Lock Screen ────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-yellow-400" />
            </div>
            <h1 className="text-xl font-black text-white">Admin Playground</h1>
            <p className="text-sm text-neutral-500 mt-1">ADN Capital — Khu vực bảo mật</p>
          </div>

          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={e => { setPw(e.target.value); setPwError(false); }}
                onKeyDown={e => e.key === "Enter" && handleUnlock()}
                placeholder="Mật khẩu Admin..."
                className={`w-full bg-white/[0.05] border rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-neutral-600 focus:outline-none transition-colors ${
                  pwError ? "border-red-500/50 focus:border-red-500" : "border-white/[0.10] focus:border-yellow-500/50"
                }`}
              />
              <button onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {pwError && <p className="text-xs text-red-400 font-bold">Mật khẩu sai. Thử lại.</p>}
            <button
              onClick={handleUnlock}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-[#050508] font-black text-sm hover:opacity-90 transition-opacity"
            >
              Mở Khóa
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Admin Dashboard ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-yellow-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center">
              <Shield className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Admin Playground</h1>
              <p className="text-sm text-neutral-500">ADN Capital — Quản lý hệ thống</p>
            </div>
          </div>
        </motion.div>

        {/* Toast */}
        <div className="fixed top-6 right-6 z-50">
          <AnimatePresence>
            {toast && <Toast key="toast" type={toast.type} message={toast.message} />}
          </AnimatePresence>
        </div>

        {/* Main Toggle Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`relative overflow-hidden rounded-2xl border transition-all duration-500 ${
            mockMode
              ? "bg-gradient-to-br from-yellow-500/10 to-orange-500/[0.05] border-yellow-500/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]"
              : "bg-white/[0.03] border-white/[0.08]"
          }`}
        >
          {/* Animated glow when active */}
          <AnimatePresence>
            {mockMode && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/60 to-transparent"
              />
            )}
          </AnimatePresence>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Zap className={`w-4 h-4 ${mockMode ? "text-yellow-400" : "text-neutral-600"}`} />
                  <h2 className={`font-black text-base ${mockMode ? "text-yellow-400" : "text-white"}`}>
                    CHẾ ĐỘ TRÌNH DIỄN
                  </h2>
                  <AnimatePresence>
                    {mockMode && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-[9px] font-black uppercase tracking-wider"
                      >
                        ĐANG BẬT
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <p className="text-xs text-neutral-500 max-w-sm">
                  {mockMode
                    ? "🎬 Hệ thống đang dùng Mock Data (FPT, MWG, VCG). FiinQuant API KHÔNG được gọi."
                    : "Bật để dùng dữ liệu giả lập cho buổi trình diễn. Server không cần khởi động lại."}
                </p>
              </div>
              <ToggleSwitch enabled={mockMode} onChange={handleToggle} loading={loading} />
            </div>

            {/* Status indicator */}
            <AnimatePresence>
              {mockMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-yellow-500/15"
                >
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {["FPT", "MWG", "VCG"].map(t => (
                      <div key={t} className="rounded-lg bg-yellow-500/[0.08] border border-yellow-500/15 py-2">
                        <p className="text-[11px] font-black text-yellow-400">{t}</p>
                        <p className="text-[9px] text-yellow-600/70 mt-0.5">Mock Active</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3"
        >
          <h3 className="text-xs font-black text-neutral-400 uppercase tracking-widest">Hướng dẫn sử dụng</h3>
          {[
            { icon: "1", text: "Bật toggle khi bắt đầu buổi demo — hệ thống tự dùng mock data ngay" },
            { icon: "2", text: "Hỏi bot: \"FPT sao em?\" → Sẽ hiện TickerWidget với data đẹp sẵn sàng" },
            { icon: "3", text: "Tắt toggle sau khi xong — hệ thống tự về Real Data FiinQuant" },
            { icon: "🔒", text: "Cache 10 giây — toggle có hiệu lực sau tối đa 10s" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-[10px] font-black text-neutral-500 flex-shrink-0">{item.icon}</span>
              <p className="text-xs text-neutral-500 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </motion.div>

        {/* Production note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}
        >
          Khi deploy production, IS_MOCK_MODE mặc định = <span className="font-mono" style={{ color: "var(--text-muted)" }}>false</span> (Real Data)
        </motion.p>
      </div>
    </div>
  );
}
