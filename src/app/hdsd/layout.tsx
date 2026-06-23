import { Shell } from "@/components/marketing/theme";
import { isAdmin } from "@/lib/admin-check";
import { getGuideTree } from "@/lib/guide";
import DocsSidebar from "./DocsSidebar";
import DocsMobileBar from "./DocsMobileBar";
import s from "./docs.module.css";

export const dynamic = "force-dynamic";

export default async function HdsdLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  const tree = await getGuideTree(admin);

  return (
    <Shell>
      <DocsMobileBar tree={tree} />
      <div className={s.wrap}>
        <DocsSidebar tree={tree} isAdmin={admin} />
        <div className={s.main}>{children}</div>
      </div>
    </Shell>
  );
}
