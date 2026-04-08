"use client";

export default function TinTucError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Có lỗi xảy ra</h2>
        <p className="text-sm text-neutral-400 mb-6">
          Trang Tin Tức không thể tải. Vui lòng thử lại.
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-colors cursor-pointer"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
