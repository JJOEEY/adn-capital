import { Header } from "./Header";
import { Footer } from "./Footer";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen overflow-x-hidden flex flex-col">
      <Header />
      <main className="pt-20 overflow-x-hidden overflow-y-auto flex-1">{children}</main>
      <Footer />
    </div>
  );
}
