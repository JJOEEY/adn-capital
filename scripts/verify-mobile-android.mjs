import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const packageJson = readJson("package.json");
const dependencies = packageJson.dependencies ?? {};
const devDependencies = packageJson.devDependencies ?? {};

assert(dependencies["@capacitor/core"], "Missing dependency: @capacitor/core");
assert(dependencies["@capacitor/android"], "Missing dependency: @capacitor/android");
assert(devDependencies["@capacitor/cli"], "Missing devDependency: @capacitor/cli");
assert(devDependencies["@capacitor/assets"], "Missing devDependency: @capacitor/assets");
assert(packageJson.scripts?.["mobile:assets:android"], "Missing script: mobile:assets:android");
assert(packageJson.scripts?.["mobile:sync:android"], "Missing script: mobile:sync:android");
assert(packageJson.scripts?.["mobile:apk:debug"], "Missing script: mobile:apk:debug");
assert(packageJson.scripts?.["mobile:apk:release"], "Missing script: mobile:apk:release");

assert(existsSync(path.join(root, "capacitor.config.ts")), "Missing capacitor.config.ts");
const capacitorConfig = readText("capacitor.config.ts");
assert(capacitorConfig.includes("vn.adncapital.app"), "Capacitor appId must be vn.adncapital.app");
assert(capacitorConfig.includes("CAPACITOR_SERVER_URL"), "Capacitor config must support CAPACITOR_SERVER_URL");
assert(capacitorConfig.includes("https://adncapital.com.vn"), "Capacitor config must include the default ADN HTTPS URL");
assert(capacitorConfig.includes("appStartPath: \"/dashboard\""), "Capacitor config must start at /dashboard");
assert(capacitorConfig.includes("cleartext: false"), "Android WebView must keep cleartext disabled");

assert(existsSync(path.join(root, "mobile-shell", "index.html")), "Missing mobile-shell/index.html");
assert(existsSync(path.join(root, "mobile-shell", "offline.html")), "Missing mobile-shell/offline.html");
assert(existsSync(path.join(root, "assets", "icon-only.png")), "Missing Capacitor icon asset");
assert(existsSync(path.join(root, "assets", "icon-foreground.png")), "Missing Capacitor adaptive foreground asset");
assert(existsSync(path.join(root, "assets", "icon-background.png")), "Missing Capacitor adaptive background asset");
assert(existsSync(path.join(root, "assets", "splash.png")), "Missing Capacitor splash asset");

assert(existsSync(path.join(root, "android", "app", "build.gradle")), "Missing Android Gradle app module");
assert(existsSync(path.join(root, "android", "app", "src", "main", "AndroidManifest.xml")), "Missing AndroidManifest.xml");
assert(existsSync(path.join(root, "android", "keystore.properties.example")), "Missing Android keystore template");
assert(existsSync(path.join(root, "docs", "mobile", "ANDROID_APK.md")), "Missing Android APK runbook");

const manifest = readText("android/app/src/main/AndroidManifest.xml");
assert(manifest.includes("android.permission.INTERNET"), "Android app must request INTERNET permission");
assert(manifest.includes('android:allowBackup="false"'), "Android app backup must be disabled for finance/session data");
assert(manifest.includes('android:usesCleartextTraffic="false"'), "Android app must explicitly disable cleartext traffic");

const gradleApp = readText("android/app/build.gradle");
assert(gradleApp.includes("keystore.properties"), "Release build must read android/keystore.properties when present");
assert(gradleApp.includes("signingConfig signingConfigs.release"), "Release build must apply release signing when configured");

assert(
  existsSync(path.join(root, "android", "app", "src", "main", "res", "mipmap-mdpi", "ic_launcher_background.png")),
  "Generated Android adaptive icon background is missing"
);

const rootLayout = readText("src/app/layout.tsx");
assert(rootLayout.includes("viewport-fit=cover"), "Root viewport must enable viewport-fit=cover for native safe areas");
assert(rootLayout.includes("adn-native-app"), "Root layout must tag ADN native WebView runtime");

assert(existsSync(path.join(root, "src", "lib", "mobileRuntime.ts")), "Missing mobile runtime detection helper");
const mobileRuntime = readText("src/lib/mobileRuntime.ts");
assert(mobileRuntime.includes("ADNCapitalAndroid"), "Mobile runtime helper must detect Android WebView user agent");
assert(mobileRuntime.includes("Capacitor"), "Mobile runtime helper must detect Capacitor runtime");

const bottomTabBar = readText("src/components/pwa/BottomTabBar.tsx");
const splashScreen = readText("src/components/pwa/SplashScreen.tsx");
assert(!bottomTabBar.includes("framer-motion"), "BottomTabBar must avoid framer-motion in the mobile shell");
assert(!splashScreen.includes("framer-motion"), "SplashScreen must avoid framer-motion in the mobile shell");

console.log("[mobile:android] readiness checks passed");
