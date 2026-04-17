import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { Manrope, Orbitron } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["900"],
  variable: "--font-orbitron",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ADN Capital - Trợ lý Chứng khoán Việt Nam",
  description:
    "Hệ thống AI phân tích chứng khoán Việt Nam chuyên nghiệp. Phân tích kỹ thuật, cơ bản, tín hiệu giao dịch.",
  keywords: ["chứng khoán", "AI", "phân tích kỹ thuật", "Vietnam stock", "ADN AI"],
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

const hydrationFixScript = `
(function(){
  if(typeof Node==='undefined')return;
  var oRC=Node.prototype.removeChild;
  Node.prototype.removeChild=function(c){
    if(c.parentNode!==this){return c}
    return oRC.apply(this,arguments)
  };
  var oIB=Node.prototype.insertBefore;
  Node.prototype.insertBefore=function(n,r){
    if(r&&r.parentNode!==this){return n}
    return oIB.apply(this,arguments)
  };
})();
`;

const themeScript = `
(function(){
  try{
    var theme=localStorage.getItem('adn-theme')||'light';
    document.documentElement.classList.remove('dark','light');
    document.documentElement.classList.add(theme);
  }catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#F8F7F2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ADN Capital" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: hydrationFixScript }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('[ADN] Service Worker registered, scope:', reg.scope);
              }).catch(function(err) {
                console.log('[ADN] SW registration failed:', err);
              });
            });
          }
        `,
          }}
        />
      </head>
      <body className={`${manrope.variable} ${orbitron.variable} antialiased min-h-screen text-base leading-relaxed`} suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
