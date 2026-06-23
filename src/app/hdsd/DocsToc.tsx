"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import s from "./docs.module.css";

type TocItem = { id: string; text: string; level: number };

/** "Trên trang này" — đọc heading có id trong #guide-article, scroll-spy. */
export default function DocsToc() {
  const pathname = usePathname();
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const root = document.getElementById("guide-article");
    if (!root) return;
    const hs = Array.from(root.querySelectorAll("h2[id], h3[id]")) as HTMLElement[];
    setItems(
      hs.map((h) => ({ id: h.id, text: h.textContent || "", level: h.tagName === "H3" ? 3 : 2 }))
    );
    if (hs.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-86px 0px -68% 0px", threshold: 0 }
    );
    hs.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [pathname]);

  if (items.length < 2) return null;

  return (
    <nav className={s.toc} aria-label="Trên trang này">
      <p className={s.tocTitle}>Trên trang này</p>
      <ul>
        {items.map((it) => (
          <li key={it.id} className={it.level === 3 ? s.tocSub : undefined}>
            <a
              href={`#${it.id}`}
              className={active === it.id ? s.tocOn : s.tocLink}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(it.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                history.replaceState(null, "", `#${it.id}`);
              }}
            >
              {it.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
