"use client";

import Link from "next/link";
import { ChevronDown, GripVertical } from "lucide-react";
import type { GuideNavCategory } from "@/lib/guide";
import s from "./docs.module.css";

function norm(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

type Props = {
  cats: GuideNavCategory[];
  query: string;
  activeHref: string;
  collapsed: Record<string, boolean>;
  toggleCat: (id: string) => void;
  onNavigate?: () => void;
  reorder?: boolean;
  dragId?: string | null;
  onDragStart?: (sectionId: string, categoryId: string) => void;
  onDropOn?: (targetSectionId: string, targetCategoryId: string) => void;
};

export default function NavTree({
  cats,
  query,
  activeHref,
  collapsed,
  toggleCat,
  onNavigate,
  reorder = false,
  dragId,
  onDragStart,
  onDropOn,
}: Props) {
  const q = norm(query.trim());
  const filtered = cats
    .map((c) => ({
      ...c,
      sections: q ? c.sections.filter((sec) => norm(sec.title).includes(q)) : c.sections,
    }))
    .filter((c) => c.sections.length > 0);

  if (filtered.length === 0) {
    return <p className={s.emptyNote}>{query.trim() ? "Không có kết quả." : "Chưa có nội dung."}</p>;
  }

  return (
    <>
      {filtered.map((cat) => {
        const isCollapsed = !q && (collapsed[cat.id] ?? false);
        return (
          <div key={cat.id} className={`${s.cat} ${isCollapsed ? s.catCollapsed : ""}`}>
            <button type="button" className={s.catHead} onClick={() => toggleCat(cat.id)}>
              {cat.title}
              <ChevronDown size={13} className={s.catChevron} />
            </button>
            {!isCollapsed && (
              <div className={s.secList}>
                {cat.sections.map((sec) => {
                  const href = `/hdsd/${cat.slug}/${sec.slug}`;
                  const active = activeHref === href;
                  return (
                    <Link
                      key={sec.id}
                      href={href}
                      onClick={onNavigate}
                      className={`${active ? s.secOn : s.secLink}`}
                      draggable={reorder}
                      onDragStart={() => reorder && onDragStart?.(sec.id, cat.id)}
                      onDragOver={(e) => {
                        if (reorder) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (!reorder) return;
                        e.preventDefault();
                        onDropOn?.(sec.id, cat.id);
                      }}
                      style={dragId === sec.id ? { opacity: 0.45 } : undefined}
                    >
                      {reorder && <GripVertical size={13} className={s.grip} />}
                      <span style={{ flex: 1 }}>{sec.title}</span>
                      {!sec.published && <span className={s.draftDot}>NHÁP</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
