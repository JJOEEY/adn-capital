import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADN Capital - Trợ lý Chứng khoán Việt Nam",
  description: "Hệ thống AI phân tích chứng khoán Việt Nam chuyên nghiệp. Phân tích kỹ thuật, cơ bản, tín hiệu giao dịch.",
  keywords: ["chứng khoán", "AI", "phân tích kỹ thuật", "Vietnam stock", "ADN AI"],
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
  },
};

// Patch removeChild/insertBefore để tránh crash do browser extension chèn DOM
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        {/* PWA Meta Tags */}
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ADN Capital" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <script dangerouslySetInnerHTML={{ __html: hydrationFixScript }} />
        {/* Service Worker Registration */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('[ADN] Service Worker registered, scope:', reg.scope);
              }).catch(function(err) {
                console.log('[ADN] SW registration failed:', err);
              });
            });
          }
        `}} />
      </head>
      <body className="antialiased min-h-screen overflow-x-hidden" suppressHydrationWarning>
        <AuthProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
