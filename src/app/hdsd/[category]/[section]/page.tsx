import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { isAdmin } from "@/lib/admin-check";
import { getGuideSectionBySlugs, guideExcerpt, stripLeadingTitle } from "@/lib/guide";
import GuideMarkdown from "../../GuideMarkdown";
import DocsToc from "../../DocsToc";
import AdminSectionTools from "../../AdminSectionTools";
import s from "../../docs.module.css";

export const dynamic = "force-dynamic";

type Params = { category: string; section: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, section } = await params;
  const data = await getGuideSectionBySlugs(category, section, false);
  if (!data) return { title: "Không tìm thấy — Hướng dẫn ADN Capital" };
  const desc = guideExcerpt(data.section.content);
  const url = `/hdsd/${category}/${section}`;
  return {
    title: `${data.section.title} — Hướng dẫn ADN Capital`,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: `${data.section.title} — Hướng dẫn ADN Capital`,
      description: desc,
      url,
      siteName: "ADN Capital",
      locale: "vi_VN",
    },
  };
}

export default async function GuideSectionPage({ params }: { params: Promise<Params> }) {
  const { category, section } = await params;
  const admin = await isAdmin();
  const data = await getGuideSectionBySlugs(category, section, admin);
  if (!data) notFound();

  const { section: sec, prev, next } = data;
  const url = `https://adncapital.com.vn/hdsd/${category}/${section}`;
  const desc = guideExcerpt(sec.content);
  const updated = new Date(sec.updatedAt).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: sec.title,
    description: desc,
    inLanguage: "vi-VN",
    author: { "@type": "Organization", name: "ADN Capital" },
    publisher: { "@type": "Organization", name: "ADN Capital", url: "https://adncapital.com.vn" },
    dateModified: sec.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: "https://adncapital.com.vn/" },
      { "@type": "ListItem", position: 2, name: "Hướng dẫn", item: "https://adncapital.com.vn/hdsd" },
      { "@type": "ListItem", position: 3, name: sec.category.title, item: `https://adncapital.com.vn/hdsd/${category}` },
      { "@type": "ListItem", position: 4, name: sec.title, item: url },
    ],
  };

  return (
    <div className={s.page2col}>
      <article className={s.article} id="guide-article">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

        <nav className={s.crumbs} aria-label="Breadcrumb">
          <Link href="/hdsd">Hướng dẫn</Link>
          <span>/</span>
          <span>{sec.category.title}</span>
        </nav>

        <h1 className={s.h1}>{sec.title}</h1>
        <p className={s.meta}>
          {sec.category.title} · Cập nhật {updated}
          {!sec.published && " · NHÁP"}
        </p>

        <GuideMarkdown content={stripLeadingTitle(sec.content, sec.title)} />

        <AdminSectionTools
          isAdmin={admin}
          sectionId={sec.id}
          initialContent={sec.content}
          published={sec.published}
        />

        {(prev || next) && (
          <div className={s.prevnext}>
            {prev ? (
              <Link href={prev.href} className={s.pnCard}>
                <span className={s.pnLabel}>
                  <ArrowLeft size={12} style={{ display: "inline", marginRight: 4 }} />
                  Trước
                </span>
                <span className={s.pnTitle}>{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={next.href} className={`${s.pnCard} ${s.pnNext}`}>
                <span className={s.pnLabel}>
                  Tiếp
                  <ArrowRight size={12} style={{ display: "inline", marginLeft: 4 }} />
                </span>
                <span className={s.pnTitle}>{next.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </article>

      <div className={s.tocCol}>
        <DocsToc />
      </div>
    </div>
  );
}
