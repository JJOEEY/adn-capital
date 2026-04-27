import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  absoluteUrl,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";
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

const defaultTitle = "ADN Capital | Hệ sinh thái AI đầu tư cho chứng khoán Việt Nam";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: defaultTitle,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "finance",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "/",
    siteName: SITE_NAME,
    title: defaultTitle,
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: absoluteUrl(DEFAULT_OG_IMAGE),
        width: 512,
        height: 512,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: DEFAULT_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
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

const rootJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": absoluteUrl("/#organization"),
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/brand/logo-light.jpg"),
    email: "admin@adncapital.vn",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "vi-VN",
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
  },
];

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

const mobileRuntimeScript = `
(function(){
  try{
    var ua=navigator.userAgent||'';
    var nativeApp=ua.indexOf('ADNCapitalAndroid')>-1;
    if(nativeApp){
      document.documentElement.classList.add('adn-native-app');
    }
  }catch(e){}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#F8F7F2" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="ADN Capital" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <JsonLd data={rootJsonLd} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: mobileRuntimeScript }} />
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
      <body
        className={`${manrope.variable} ${orbitron.variable} antialiased min-h-screen text-base leading-relaxed`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
