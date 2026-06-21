import { MarketingHome } from "@/components/marketing/MarketingHome";
import { PwaEntryRedirect } from "@/components/pwa/PwaEntryRedirect";

export default function Home() {
  return (
    <>
      {/* Mở từ app đã cài (standalone) -> vào thẳng /dashboard (hoặc /auth?app=1),
          không hiện landing. Trên trình duyệt thường thì render landing như cũ. */}
      <PwaEntryRedirect />
      <MarketingHome />
    </>
  );
}
