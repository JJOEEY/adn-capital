"use client";

import { Download, Printer } from "lucide-react";
import type { JournalEntry } from "@/types";

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => HTML_ESCAPE[c] ?? c);
}

export function JournalExport({ entries }: { entries: JournalEntry[] }) {
  const rows = entries.map((e) => ({
    date: fmtDate(e.tradeDate || e.createdAt),
    ticker: e.ticker,
    action: e.action === "BUY" ? "Mua" : "Bán",
    price: e.price,
    qty: e.quantity,
    value: e.price * e.quantity,
    psy: e.psychologyTag || e.psychology || "",
    reason: e.tradeReason || "",
  }));

  const exportCsv = () => {
    const header = ["Ngày", "Mã", "Loại", "Giá", "Khối lượng", "Giá trị", "Tâm lý", "Lý do"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([r.date, r.ticker, r.action, r.price, r.qty, r.value, r.psy, r.reason].map(csvCell).join(","));
    }
    // BOM để Excel đọc đúng UTF-8 (tiếng Việt)
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nhat-ky-giao-dich-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const trs = rows
      .map(
        (r) =>
          `<tr><td>${r.date}</td><td><b>${esc(r.ticker)}</b></td><td>${r.action}</td>` +
          `<td class="r">${r.price.toLocaleString("vi-VN")}</td><td class="r">${r.qty.toLocaleString("vi-VN")}</td>` +
          `<td class="r">${r.value.toLocaleString("vi-VN")}</td><td>${esc(r.psy)}</td><td>${esc(r.reason)}</td></tr>`,
      )
      .join("");
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Nhật ký giao dịch</title>` +
        `<style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#111}` +
        `h1{font-size:18px;margin:0 0 4px}p{color:#666;font-size:12px;margin:0 0 16px}` +
        `table{width:100%;border-collapse:collapse;font-size:12px}` +
        `th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}` +
        `th{background:#f5f5f5}.r{text-align:right;font-variant-numeric:tabular-nums}</style></head><body>` +
        `<h1>Nhật ký giao dịch — ADN Capital</h1>` +
        `<p>Xuất ngày ${fmtDate(new Date().toISOString())} · ${rows.length} lệnh</p>` +
        `<table><thead><tr><th>Ngày</th><th>Mã</th><th>Loại</th><th>Giá</th><th>KL</th><th>Giá trị</th><th>Tâm lý</th><th>Lý do</th></tr></thead>` +
        `<tbody>${trs}</tbody></table></body></html>`,
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const disabled = entries.length === 0;
  const btnCls = "flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-50";
  const btnStyle = { background: "var(--surface-2)", borderColor: "var(--border)", color: "var(--text-secondary)" } as const;

  return (
    <div className="flex gap-2">
      <button onClick={exportCsv} disabled={disabled} className={btnCls} style={btnStyle} title="Xuất file CSV (Excel)">
        <Download className="w-3.5 h-3.5" /> CSV
      </button>
      <button onClick={exportPdf} disabled={disabled} className={btnCls} style={btnStyle} title="In / lưu PDF">
        <Printer className="w-3.5 h-3.5" /> PDF
      </button>
    </div>
  );
}
