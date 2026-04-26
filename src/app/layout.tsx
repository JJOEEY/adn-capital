import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { BRAND } from "@/lib/brand/productNames";
import localFont from "next/font/local";
import "./globals.css";

const manrope = localFont({
  src: [
    {
      path: "../fonts/Manrope-Variable.ttf",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--font-manrope",
  display: "swap",
});

const orbitron = localFont({
  src: [
    {
      path: "../fonts/Orbitron-Variable.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-orbitron",
  display: "swap",
});

const siteUrl = "https://adncapital.com.vn";
const siteDescription =
  "ADNexus là hệ điều hành đầu tư AI cho chứng khoán Việt Nam: đọc thị trường, theo dõi cơ hội, giữ kỷ luật và hỏi AIDEN trong một workflow thống nhất.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${BRAND.platform} | ${BRAND.company}`,
    template: `%s | ${BRAND.company}`,
  },
  description: siteDescription,
  keywords: [
    "ADNexus",
    "ADN Capital",
    "AIDEN",
    "chứng khoán Việt Nam",
    "AI đầu tư",
    "phân tích cổ phiếu",
    "NexPulse",
    "NexPilot",
    "NexART",
    "NexRank",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: siteUrl,
    siteName: BRAND.company,
    title: `${BRAND.platform} - ${BRAND.tagline}`,
    description: siteDescription,
    images: [
      {
        url: "/brand/logo-light.jpg",
        width: 1024,
        height: 1024,
        alt: `${BRAND.company} logo`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.platform} | ${BRAND.company}`,
    description: siteDescription,
    images: ["/brand/logo-light.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/brand/favicon.png", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/brand/favicon.png",
    apple: "/icons/icon-192x192.png",
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
        <meta name="apple-mobile-web-app-title" content={BRAND.platform} />
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
                if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                reg.addEventListener('updatefound', function() {
                  var worker = reg.installing;
                  if (!worker) return;
                  worker.addEventListener('statechange', function() {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                      worker.postMessage({ type: 'SKIP_WAITING' });
                    }
                  });
                });
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
