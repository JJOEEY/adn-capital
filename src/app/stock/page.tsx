"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LAST_STOCK_TICKER_STORAGE_KEY = "adn-stock-last-ticker-v1";
const FALLBACK_TICKER = "VNINDEX";

function normalizeTicker(value: string | null) {
  const ticker = (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{2,10}$/.test(ticker) ? ticker : FALLBACK_TICKER;
}

export default function StockIndexPage() {
  const router = useRouter();

  useEffect(() => {
    let ticker = FALLBACK_TICKER;
    try {
      ticker = normalizeTicker(window.localStorage.getItem(LAST_STOCK_TICKER_STORAGE_KEY));
    } catch {
      ticker = FALLBACK_TICKER;
    }
    router.replace(`/stock/${ticker}`);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 text-sm" style={{ color: "var(--text-secondary)" }}>
      Đang mở biểu đồ gần nhất...
    </div>
  );
}
