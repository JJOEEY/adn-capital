"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, ChevronDown, GripVertical, Plus, Save, Pencil, ArrowUpDown } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useCurrentDbUser } from "@/hooks/useCurrentDbUser";

type GuideSection = {
  id: string;
  title: string;
  slug: string;
  content: string;
  sortOrder: number;
  published: boolean;
  categoryId: string;
};

type GuideCategory = {
  id: string;
  title: string;
  slug: string;
  sortOrder: number;
  sections: GuideSection[];
};

type GuideApiResponse = {
  categories: GuideCategory[];
};

type DragItem = {
  sectionId: string;
  categoryId: string;
};

const markdownComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="text-2xl font-black mt-6 mb-3 tracking-tight" style={{ color: "var(--text-primary)" }} {...props} />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="text-xl font-extrabold mt-5 mb-2" style={{ color: "var(--text-primary)" }} {...props} />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="text-lg font-bold mt-4 mb-2" style={{ color: "var(--text-primary)" }} {...props} />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="leading-7 mb-3" style={{ color: "var(--text-secondary)" }} {...props} />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="list-disc pl-6 mb-3 space-y-1" style={{ color: "var(--text-secondary)" }} {...props} />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="list-decimal pl-6 mb-3 space-y-1" style={{ color: "var(--text-secondary)" }} {...props} />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => <li className="leading-7" {...props} />,
  code: ({ inline, className, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) =>
    inline ? (
      <code
        className={className}
        style={{
          background: "rgba(125,132,113,0.16)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "1px 6px",
          color: "var(--text-primary)",
        }}
        {...props}
      >
        {children}
      </code>
    ) : (
      <pre
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "12px 14px",
          overflowX: "auto",
          marginBottom: "12px",
        }}
      >
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      className="pl-4 py-1 my-3"
      style={{ borderLeft: "3px solid var(--border-strong)", color: "var(--text-secondary)" }}
      {...props}
    />
  ),
};

export default function HDSDPage() {
  const { isAdmin, isLoading: userLoading } = useCurrentDbUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<GuideCategory[]>([]);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const [editMode, setEditMode] = useState(false);
  const [editorValue, setEditorValue] = useState("");
  const [showCreateSection, setShowCreateSection] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [newSectionCategoryId, setNewSectionCategoryId] = useState("");
  const [reorderMode, setReorderMode] = useState(false);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);

  const fetchGuides = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = isAdmin ? "?include_unpublished=1" : "";
      const res = await fetch(`/api/guide/categories${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GuideApiResponse = await res.json();

      setCategories(data.categories ?? []);

      const allSections = (data.categories ?? []).flatMap((c) => c.sections ?? []);
      if (allSections.length > 0) {
        setActiveSectionId((prev) => prev ?? allSections[0].id);
        setExpanded((prev) => {
          const next = { ...prev };
          for (const section of allSections) {
            if (next[section.id] === undefined) next[section.id] = true;
          }
          return next;
        });
      }
    } catch {
      setError("Không thể tải nội dung hướng dẫn. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (userLoading) return;
    fetchGuides();
  }, [userLoading, fetchGuides]);

  const allSections = useMemo(() => categories.flatMap((c) => c.sections), [categories]);
  const activeSection = useMemo(
    () => allSections.find((s) => s.id === activeSectionId) ?? null,
    [allSections, activeSectionId]
  );

  useEffect(() => {
    if (!editMode || !activeSection) return;
    setEditorValue(activeSection.content);
  }, [editMode, activeSection]);

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(`guide-${sectionId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const selectSection = useCallback(
    (sectionId: string) => {
      setActiveSectionId(sectionId);
      setExpanded((prev) => ({ ...prev, [sectionId]: true }));
      scrollToSection(sectionId);
    },
    [scrollToSection]
  );

  const handleSaveSection = useCallback(async () => {
    if (!activeSection) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/guide/sections/${activeSection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editorValue }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchGuides();
      setEditMode(false);
    } catch {
      setError("Lưu nội dung thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }, [activeSection, editorValue, fetchGuides]);

  const handleCreateSection = useCallback(async () => {
    if (!newSectionTitle.trim() || !newSectionCategoryId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/guide/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSectionTitle.trim(),
          categoryId: newSectionCategoryId,
          content: `## ${newSectionTitle.trim()}\n\nĐang cập nhật nội dung...`,
          sortOrder: Date.now(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setNewSectionTitle("");
      setShowCreateSection(false);
      await fetchGuides();
    } catch {
      setError("Tạo mục mới thất bại. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  }, [newSectionTitle, newSectionCategoryId, fetchGuides]);

  const handleDeleteSection = useCallback(
    async (sectionId: string) => {
      if (!window.confirm("Bạn chắc chắn muốn xoá mục này?")) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/guide/sections/${sectionId}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await fetchGuides();
      } catch {
        setError("Xoá mục thất bại. Vui lòng thử lại.");
      } finally {
        setSaving(false);
      }
    },
    [fetchGuides]
  );

  const handleDropSection = useCallback(
    async (targetSectionId: string, targetCategoryId: string) => {
      if (!dragItem) return;
      if (dragItem.sectionId === targetSectionId && dragItem.categoryId === targetCategoryId) return;

      const sourceCategory = categories.find((c) => c.id === dragItem.categoryId);
      const targetCategory = categories.find((c) => c.id === targetCategoryId);
      if (!sourceCategory || !targetCategory) return;

      const draggedSection = sourceCategory.sections.find((s) => s.id === dragItem.sectionId);
      if (!draggedSection) return;

      let nextCategories = categories.map((c) => ({
        ...c,
        sections: [...c.sections],
      }));

      nextCategories = nextCategories.map((c) => {
        if (c.id === sourceCategory.id) {
          return { ...c, sections: c.sections.filter((s) => s.id !== draggedSection.id) };
        }
        return c;
      });

      nextCategories = nextCategories.map((c) => {
        if (c.id !== targetCategory.id) return c;
        const targetIndex = c.sections.findIndex((s) => s.id === targetSectionId);
        if (targetIndex < 0) return c;
        const updated = [...c.sections];
        updated.splice(targetIndex, 0, { ...draggedSection, categoryId: targetCategory.id });
        return { ...c, sections: updated };
      });

      nextCategories = nextCategories.map((c) => ({
        ...c,
        sections: c.sections.map((s, idx) => ({
          ...s,
          sortOrder: (idx + 1) * 10,
        })),
      }));

      setCategories(nextCategories);

      const payloadItems = nextCategories
        .flatMap((c) => c.sections.map((s) => ({ id: s.id, sortOrder: s.sortOrder, categoryId: c.id })));

      try {
        const res = await fetch(`/api/guide/sections/${dragItem.sectionId}/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: payloadItems }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        setError("Sắp xếp thất bại, đang tải lại dữ liệu.");
        await fetchGuides();
      }
    },
    [dragItem, categories, fetchGuides]
  );

  useEffect(() => {
    if (showCreateSection && categories.length > 0 && !newSectionCategoryId) {
      setNewSectionCategoryId(categories[0].id);
    }
  }, [showCreateSection, categories, newSectionCategoryId]);

  return (
    <MainLayout>
      <div className="w-full h-full px-0 md:px-2 py-0 md:py-2">
        <div className="relative rounded-none md:rounded-2xl overflow-hidden border-0 md:border h-[calc(100vh-56px)] md:h-[calc(100vh-110px)]" style={{ background: "var(--bg-page)", borderColor: "var(--border)" }}>
          {isAdmin && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
              <button
                onClick={() => {
                  setShowCreateSection((v) => !v);
                  setEditMode(false);
                }}
                className="px-3 h-8 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm mục
              </button>
              <button
                onClick={() => {
                  setEditMode((v) => !v);
                  setShowCreateSection(false);
                }}
                disabled={!activeSection}
                className="px-3 h-8 rounded-full text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Chỉnh sửa
              </button>
              <button
                onClick={() => setReorderMode((v) => !v)}
                className="px-3 h-8 rounded-full text-xs font-bold flex items-center gap-1.5"
                style={{
                  background: reorderMode ? "rgba(46,77,61,0.16)" : "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sắp xếp
              </button>
            </div>
          )}

          <div className="grid h-full" style={{ gridTemplateColumns: "240px minmax(0,1fr)" }}>
            <aside
              className="h-full overflow-y-auto px-3 py-4"
              style={{ background: "var(--surface)", borderRight: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 px-2 mb-4">
                <BookOpen className="w-4 h-4" style={{ color: "#f59e0b" }} />
                <p className="text-sm font-black tracking-wide" style={{ color: "var(--text-primary)" }}>
                  Hướng dẫn sử dụng
                </p>
              </div>

              {loading && <p className="px-2 text-sm" style={{ color: "var(--text-secondary)" }}>Đang tải...</p>}
              {!loading && categories.length === 0 && (
                <p className="px-2 text-sm" style={{ color: "var(--text-secondary)" }}>Chưa có nội dung.</p>
              )}

              <div className="space-y-3">
                {categories.map((category) => (
                  <div key={category.id}>
                    <p className="px-2 text-[11px] uppercase tracking-wider font-black mb-1" style={{ color: "var(--text-muted)" }}>
                      {category.title}
                    </p>
                    <div className="space-y-1">
                      {category.sections.map((section) => {
                        const active = activeSectionId === section.id;
                        return (
                          <button
                            key={section.id}
                            onClick={() => selectSection(section.id)}
                            draggable={isAdmin && reorderMode}
                            onDragStart={() => setDragItem({ sectionId: section.id, categoryId: category.id })}
                            onDragOver={(e) => {
                              if (isAdmin && reorderMode) e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (!isAdmin || !reorderMode) return;
                              void handleDropSection(section.id, category.id);
                            }}
                            className="w-full text-left rounded-xl px-2 py-2 text-sm transition-all flex items-start gap-1.5"
                            style={{
                              background: active ? "rgba(46,77,61,0.14)" : "transparent",
                              border: active ? "1px solid rgba(46,77,61,0.25)" : "1px solid transparent",
                              color: active ? "var(--text-primary)" : "var(--text-secondary)",
                            }}
                          >
                            {isAdmin && reorderMode && <GripVertical className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                            <span>{section.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <section className="h-full overflow-y-auto px-4 md:px-8 py-6 md:py-8">
              {error && (
                <div
                  className="mb-4 rounded-xl px-3 py-2 text-sm"
                  style={{ background: "rgba(220,38,38,0.10)", color: "#ef4444", border: "1px solid rgba(220,38,38,0.20)" }}
                >
                  {error}
                </div>
              )}

              {isAdmin && showCreateSection && (
                <div className="mb-6 rounded-2xl p-4 border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                  <p className="text-sm font-bold mb-3" style={{ color: "var(--text-primary)" }}>Tạo mục hướng dẫn mới</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select
                      value={newSectionCategoryId}
                      onChange={(e) => setNewSectionCategoryId(e.target.value)}
                      className="h-10 px-3 rounded-xl text-sm"
                      style={{ background: "var(--bg-page)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                    <input
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      placeholder="Tên mục"
                      className="h-10 px-3 rounded-xl text-sm"
                      style={{ background: "var(--bg-page)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                    <button
                      onClick={() => void handleCreateSection()}
                      disabled={saving || !newSectionTitle.trim()}
                      className="h-10 rounded-xl text-sm font-bold disabled:opacity-50"
                      style={{ background: "#2E4D3D", color: "#fff" }}
                    >
                      Tạo mục
                    </button>
                  </div>
                </div>
              )}

              <div className="max-w-4xl space-y-3">
                {categories.map((category) => (
                  <div key={category.id} className="space-y-3">
                    <h2 className="text-lg font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                      {category.title}
                    </h2>

                    {category.sections.map((section) => {
                      const isOpen = expanded[section.id] ?? true;
                      const isActive = activeSectionId === section.id;
                      const isEditing = isAdmin && editMode && isActive;

                      return (
                        <article
                          key={section.id}
                          id={`guide-${section.id}`}
                          className="rounded-2xl border overflow-hidden scroll-mt-20"
                          style={{
                            background: "var(--surface)",
                            borderColor: isActive ? "rgba(46,77,61,0.30)" : "var(--border)",
                          }}
                        >
                          <button
                            onClick={() => {
                              setExpanded((prev) => ({ ...prev, [section.id]: !isOpen }));
                              setActiveSectionId(section.id);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-left"
                            style={{ background: isActive ? "rgba(46,77,61,0.06)" : "transparent" }}
                          >
                            <div className="flex items-center gap-2">
                              <p className="text-sm md:text-base font-bold" style={{ color: "var(--text-primary)" }}>
                                {section.title}
                              </p>
                              {!section.published && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-black tracking-wide" style={{ background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}>
                                  DRAFT
                                </span>
                              )}
                            </div>
                            <ChevronDown
                              className="w-4 h-4 transition-transform"
                              style={{
                                color: "var(--text-secondary)",
                                transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-4">
                              {isEditing ? (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-1">
                                  <div>
                                    <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                      Markdown
                                    </p>
                                    <textarea
                                      value={editorValue}
                                      onChange={(e) => setEditorValue(e.target.value)}
                                      className="w-full min-h-[260px] rounded-xl p-3 text-sm leading-6"
                                      style={{
                                        background: "var(--bg-page)",
                                        border: "1px solid var(--border)",
                                        color: "var(--text-primary)",
                                      }}
                                    />
                                    <div className="mt-2 flex items-center gap-2">
                                      <button
                                        onClick={() => void handleSaveSection()}
                                        disabled={saving}
                                        className="h-9 px-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-1.5"
                                        style={{ background: "#2E4D3D", color: "#fff" }}
                                      >
                                        <Save className="w-3.5 h-3.5" />
                                        Lưu
                                      </button>
                                      <button
                                        onClick={() => setEditMode(false)}
                                        className="h-9 px-3 rounded-xl text-sm font-bold"
                                        style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                      >
                                        Huỷ
                                      </button>
                                      <button
                                        onClick={() => void handleDeleteSection(section.id)}
                                        className="h-9 px-3 rounded-xl text-sm font-bold"
                                        style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.28)", color: "#ef4444" }}
                                      >
                                        Xoá mục
                                      </button>
                                    </div>
                                  </div>

                                  <div>
                                    <p className="text-xs font-bold mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                      Preview
                                    </p>
                                    <div
                                      className="rounded-xl p-3 min-h-[260px]"
                                      style={{
                                        background: "var(--bg-page)",
                                        border: "1px solid var(--border)",
                                      }}
                                    >
                                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {editorValue || "Nội dung trống."}
                                      </ReactMarkdown>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-1">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {section.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

