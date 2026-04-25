import type { CapacitorConfig } from "@capacitor/cli";

const mobileServerUrl = process.env.CAPACITOR_SERVER_URL?.trim() || "https://adncapital.com.vn";

const config: CapacitorConfig = {
  appId: "vn.adncapital.app",
  appName: "ADN Capital",
  webDir: "mobile-shell",
  backgroundColor: "#F8F7F2",
  loggingBehavior: "debug",
  zoomEnabled: false,
  android: {
    path: "android",
    appendUserAgent: " ADNCapitalAndroid/1.0",
  },
  server: {
    url: mobileServerUrl,
    cleartext: false,
    errorPath: "offline.html",
    appStartPath: "/dashboard",
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#F8F7F2",
      showSpinner: false,
    },
  },
};

export default config;
