import { Metadata } from "next";
import { ArticleDetailClient } from "@/components/news/ArticleDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${slug.replace(/-/g, " ")} | ADN Capital`,
  };
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params;
  return <ArticleDetailClient slug={slug} />;
}
