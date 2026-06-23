"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Plus, ArrowUpDown } from "lucide-react";
import type { GuideNavCategory } from "@/lib/guide";
import NavTree from "./NavTree";
import s from "./docs.module.css";

type DragItem = { sectionId: string; categoryId: string };

export default function DocsSidebar({
  tree,
  isAdmin,
}: {
  tree: GuideNavCategory[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [cats, setCats] = useState<GuideNavCategory[]>(tree);

  const [showAdd, setShowAdd] = useState(false);
  const [addCat, setAddCat] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [busy, setBusy] = useState(false);

  // resync khi server trả tree mới (sau router.refresh)
  useEffect(() => setCats(tree), [tree]);
  useEffect(() => {
    if (showAdd && !addCat && cats[0]) setAddCat(cats[0].id);
  }, [showAdd, addCat, cats]);

  // ⌘K / Ctrl-K focus ô tìm kiếm
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCat = useCallback(
    (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] })),
    []
  );

  const handleAdd = useCallback(async () => {
    if (!addTitle.trim() || !addCat) return;
    setBusy(true);
    try {
      const res = await fetch("/api/guide/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          categoryId: addCat,
          content: `## ${addTitle.trim()}\n\nNội dung đang được biên soạn.`,
        }),
      });
      if (!res.ok) throw new Error();
      setAddTitle("");
      setShowAdd(false);
      router.refresh();
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  }, [addTitle, addCat, router]);

  const handleDrop = useCallback(
    async (targetSectionId: string, targetCategoryId: string) => {
      if (!dragItem) return;
      if (dragItem.sectionId === targetSectionId) return;

      const source = cats.find((c) => c.id === dragItem.categoryId);
      const target = cats.find((c) => c.id === targetCategoryId);
      if (!source || !target) return;
      const dragged = source.sections.find((x) => x.id === dragItem.sectionId);
      if (!dragged) return;

      let next = cats.map((c) => ({ ...c, sections: [...c.sections] }));
      next = next.map((c) =>
        c.id === source.id ? { ...c, sections: c.sections.filter((x) => x.id !== dragged.id) } : c
      );
      next = next.map((c) => {
        if (c.id !== target.id) return c;
        const ti = c.sections.findIndex((x) => x.id === targetSectionId);
        const arr = [...c.sections];
        arr.splice(ti < 0 ? arr.length : ti, 0, dragged);
        return { ...c, sections: arr };
      });
      next = next.map((c) => ({
        ...c,
        sections: c.sections.map((x, i) => ({ ...x, sortOrder: (i + 1) * 10 })),
      }));
      setCats(next);

      const items = next.flatMap((c) =>
        c.sections.map((x) => ({ id: x.id, sortOrder: x.sortOrder, categoryId: c.id }))
      );
      try {
        const res = await fetch(`/api/guide/sections/${dragItem.sectionId}/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error();
        router.refresh();
      } catch {
        setCats(tree);
      } finally {
        setDragItem(null);
      }
    },
    [dragItem, cats, tree, router]
  );

  return (
    <aside className={s.sidebar}>
      <div className={s.searchWrap}>
        <Search size={15} className={s.searchIcon} />
        <input
          ref={searchRef}
          className={s.search}
          placeholder="Tìm trong hướng dẫn…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!query && <span className={s.kbd}>⌘K</span>}
      </div>

      {isAdmin && (
        <>
          <div className={s.adminBar}>
            <button
              type="button"
              className={`${s.adminBtn} ${showAdd ? s.adminBtnOn : ""}`}
              onClick={() => setShowAdd((v) => !v)}
            >
              <Plus size={13} /> Thêm mục
            </button>
            <button
              type="button"
              className={`${s.adminBtn} ${reorderMode ? s.adminBtnOn : ""}`}
              onClick={() => setReorderMode((v) => !v)}
            >
              <ArrowUpDown size={13} /> Sắp xếp
            </button>
          </div>
          {showAdd && (
            <div className={s.addForm}>
              <select
                className={s.addSelect}
                value={addCat}
                onChange={(e) => setAddCat(e.target.value)}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <input
                className={s.addInput}
                placeholder="Tên mục mới"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
              />
              <button
                type="button"
                className="dp-btn dp-btn-solid"
                style={{ height: 34, fontSize: 13, justifyContent: "center" }}
                disabled={busy || !addTitle.trim()}
                onClick={() => void handleAdd()}
              >
                Tạo mục
              </button>
            </div>
          )}
        </>
      )}

      <NavTree
        cats={cats}
        query={query}
        activeHref={pathname}
        collapsed={collapsed}
        toggleCat={toggleCat}
        reorder={isAdmin && reorderMode}
        dragId={dragItem?.sectionId ?? null}
        onDragStart={(sectionId, categoryId) => setDragItem({ sectionId, categoryId })}
        onDropOn={(t, c) => void handleDrop(t, c)}
      />
    </aside>
  );
}
