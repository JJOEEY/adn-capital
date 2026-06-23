"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Search, BookOpen } from "lucide-react";
import type { GuideNavCategory } from "@/lib/guide";
import NavTree from "./NavTree";
import s from "./docs.module.css";

export default function DocsMobileBar({ tree }: { tree: GuideNavCategory[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // khoá scroll nền khi mở drawer
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const toggleCat = useCallback(
    (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] })),
    []
  );

  return (
    <>
      <div className={s.mobileBar}>
        <button type="button" className={s.mobileBtn} onClick={() => setOpen(true)}>
          <Menu size={16} /> Mục lục
        </button>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
          <BookOpen size={15} /> Hướng dẫn
        </span>
      </div>

      {open && (
        <>
          <button type="button" className={s.drawerScrim} aria-label="Đóng" onClick={() => setOpen(false)} />
          <aside className={s.drawer}>
            <div className={s.drawerHead}>
              <span style={{ fontWeight: 700 }}>Mục lục</span>
              <button type="button" className={s.drawerClose} onClick={() => setOpen(false)} aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <div className={s.searchWrap}>
              <Search size={15} className={s.searchIcon} />
              <input
                className={s.search}
                placeholder="Tìm trong hướng dẫn…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <NavTree
              cats={tree}
              query={query}
              activeHref={pathname}
              collapsed={collapsed}
              toggleCat={toggleCat}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}
