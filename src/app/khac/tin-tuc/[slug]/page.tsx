import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { JsonLd } from "@/components/seo/JsonLd";
import { prisma } from "@/lib/prisma";
import {
  absoluteUrl,
  articleDescription,
  DEFAULT_DESCRIPTION,
  DEFAULT_OG_IMAGE,
  parseJsonTags,
  SITE_NAME,
} from "@/lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

const getArticle = cache(async (slug: string) =>
  prisma.article.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
  }),
);

const getRelatedArticles = cache(async (categoryId: string | null, articleId: string) => {
  if (!categoryId) return [];

  return prisma.article.findMany({
    where: {
      categoryId,
      id: { not: articleId },
      status: "PUBLISHED",
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: 5,
  });
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) {
    return {
      title: "Bài viết không tồn tại",
      description: DEFAULT_DESCRIPTION,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const description = articleDescription(article);
  const articleUrl = `/khac/tin-tuc/${article.slug}`;
  const imageUrl = article.imageUrl ? absoluteUrl(article.imageUrl) : absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title: article.title,
    description,
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      type: "article",
      url: articleUrl,
      siteName: SITE_NAME,
      title: article.title,
      description,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.author?.name ?? SITE_NAME],
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description,
      images: [imageUrl],
    },
  };
}

function formatDate(date: Date | null): string {
  if (!date) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getHostname(url: string | null): string | null {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const related = await getRelatedArticles(article.categoryId, article.id);
  const tags = parseJsonTags(article.tags);
  const authorName = article.author?.name ?? SITE_NAME;
  const categoryName = article.category?.name ?? "Tin tức";
  const publishDate = formatDate(article.publishedAt);
  const description = articleDescription(article);
  const pageUrl = absoluteUrl(`/khac/tin-tuc/${article.slug}`);
  const imageUrl = article.imageUrl ? absoluteUrl(article.imageUrl) : absoluteUrl(DEFAULT_OG_IMAGE);
  const sourceHost = getHostname(article.sourceUrl);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": pageUrl,
      },
      headline: article.title,
      description,
      image: [imageUrl],
      datePublished: (article.publishedAt ?? article.createdAt).toISOString(),
      dateModified: article.updatedAt.toISOString(),
      author: {
        "@type": "Person",
        name: authorName,
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl("/logo.jpg"),
        },
      },
      keywords: tags.join(", "),
      inLanguage: "vi-VN",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: SITE_NAME,
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Tin tức",
          item: absoluteUrl("/khac/tin-tuc"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: article.title,
          item: pageUrl,
        },
      ],
    },
  ];

  return (
    <MainLayout>
      <JsonLd data={jsonLd} />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
          <Link href="/khac/tin-tuc" className="hover:text-blue-400 transition-colors">
            Tin tức
          </Link>
          <span>/</span>
          <span className="text-blue-400">{categoryName}</span>
        </nav>

        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight mb-4">
          {article.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 mb-6 text-sm text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
              {authorName.charAt(0)}
            </div>
            <span className="font-medium text-slate-300">{authorName}</span>
          </div>
          {publishDate && (
            <>
              <span className="text-slate-600">|</span>
              <time dateTime={(article.publishedAt ?? article.createdAt).toISOString()}>
                {publishDate}
              </time>
            </>
          )}
          {article.sentiment && (
            <>
              <span className="text-slate-600">|</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-300">
                {article.sentiment}
              </span>
            </>
          )}
          {sourceHost && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500">
                Nguồn: <span className="text-blue-400">{sourceHost}</span>
              </span>
            </>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/5 text-slate-400 border border-white/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {article.aiSummary && (
          <div className="relative mb-8 p-5 rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-blue-400 uppercase tracking-wider">
                AI Tóm tắt
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{article.aiSummary}</p>
          </div>
        )}

        {article.pdfUrl && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400">Báo cáo Research PDF</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Tải xuống để xem chi tiết phân tích đầy đủ.
              </p>
            </div>
            <a
              href={article.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-bold text-white bg-red-500/80 hover:bg-red-500 rounded-lg transition-colors"
            >
              Tải PDF
            </a>
          </div>
        )}

        {article.imageUrl && (
          <div className="relative aspect-[16/9] rounded-xl overflow-hidden mb-8">
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
        )}

        <article
          className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-headings:font-bold prose-p:text-slate-300 prose-p:leading-relaxed prose-strong:text-white prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline mb-12"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        <div className="border-t border-white/10 my-8" />

        {related.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-4">Tin liên quan</h2>
            <div className="bg-white/[0.02] rounded-xl border border-white/5 p-4">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/khac/tin-tuc/${item.slug}`}
                  className="group flex gap-3 py-3 border-b border-white/5 last:border-b-0"
                >
                  <div className="relative w-24 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-slate-800">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-[11px] font-bold text-slate-500 uppercase">ADN</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-200 leading-snug group-hover:text-blue-400 transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    <span className="text-[11px] text-slate-500 mt-1 block">
                      {formatDate(item.publishedAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/khac/tin-tuc"
            className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Quay lại trang tin tức
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
