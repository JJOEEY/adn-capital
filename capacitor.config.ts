import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor — vỏ Android (sideload APK, chưa lên store).
 * App nạp thẳng web LIVE adncapital.com.vn → deploy web là APK tự cập nhật,
 * KHÔNG cần build/cài lại. `webDir` chỉ là màn fallback khi mất mạng.
 *
 * Build APK:
 *   npx cap sync android
 *   cd android && ./gradlew assembleDebug      # APK: android/app/build/outputs/apk/debug/app-debug.apk
 * Hoặc mở thư mục android/ bằng Android Studio → Build > Build APK(s).
 */
const config: CapacitorConfig = {
  appId: "vn.com.adncapital.app",
  appName: "ADN Capital",
  webDir: "capacitor-shell",
  server: {
    url: "https://adncapital.com.vn",
    androidScheme: "https",
    allowNavigation: ["adncapital.com.vn", "*.adncapital.com.vn"],
  },
  android: {
    backgroundColor: "#0d0d0f",
  },
};

export default config;
