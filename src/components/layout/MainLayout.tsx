import { TopNavbar } from "./TopNavbar";
import { Footer } from "./Footer";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 overflow-x-hidden flex flex-col">
      <TopNavbar />
      <main className="pt-14 overflow-x-hidden overflow-y-auto flex-1">{children}</main>
      <Footer />
    </div>
  );
}
