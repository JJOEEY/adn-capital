import { TopNavbar } from "./TopNavbar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 overflow-x-hidden">
      <TopNavbar />
      <main className="pt-14 overflow-x-hidden overflow-y-auto">{children}</main>
    </div>
  );
}
