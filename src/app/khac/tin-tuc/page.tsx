import { Metadata } from "next";
import { NewsListClient } from "@/components/news/NewsListClient";

export const metadata: Metadata = {
  title: "Tin tức Tài chính | ADN Capital",
  description: "Cập nhật liên tục tin tức thị trường trong nước và quốc tế",
};

export default function NewsPage() {
  return <NewsListClient />;
}
