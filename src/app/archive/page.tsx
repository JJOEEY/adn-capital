"use client";

import useSWR from "swr";
import { MainLayout } from "@/components/layout/MainLayout";
import { History, Clock3 } from "lucide-react";

interface ArchiveItem {
  id: string;
  type: string;
  title: string;
  content: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function typeLabel(type: string) {
  if (type.includes("morning")) return "MORNING BRIEF";
  if (type.includes("eod")) return "EOD BRIEF";
  if (type.includes("signal")) return "SIGNAL";
  return type.toUpperCase();
}

export default function ArchivePage() {
  const { data, isLoading } = useSWR<{ notifications: ArchiveItem[] }>(
    "/api/notifications?limit=100",
    fetcher,
    { refreshInterval: 0, revalidateOnFocus: false }
  );
  const items = data?.notifications ?? [];

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
          <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>Archive Timeline</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full mt-2" style={{ background: "#16a34a" }} />
                  <div className="w-px flex-1 mt-1" style={{ background: "var(--border)" }} />
                </div>
                <article className="flex-1 rounded-2xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-black px-2 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                      {typeLabel(item.type)}
                    </span>
                    <span className="text-xs inline-flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <Clock3 className="w-3.5 h-3.5" />
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
                    </span>
                  </div>
                  <h2 className="text-base font-bold mb-2" style={{ color: "var(--text-primary)" }}>{item.title}</h2>
                  <p className="text-sm line-clamp-3" style={{ color: "var(--text-secondary)" }}>
                    {item.content}
                  </p>
                </article>
              </div>
            ))}
            {items.length === 0 && (
              <div className="rounded-2xl border p-10 text-center text-sm" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
                Chua co ban tin nao trong kho luu tru.
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

