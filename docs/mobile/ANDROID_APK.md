# ADN Android APK Runbook

This project uses Capacitor to package the existing ADN web runtime as an Android app. Data still comes from the canonical ADN web/DataHub APIs.

## Requirements

- Android Studio with Android SDK installed.
- JDK from Android Studio or a compatible local JDK.
- HTTPS ADN web runtime reachable from Android devices.
- Optional release keystore for a signed release APK.

After Android Studio is installed on Windows, set `JAVA_HOME` to Android Studio's bundled JBR if `java` is not found:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
```

## Runtime URL

The app loads `CAPACITOR_SERVER_URL` at sync time. If it is not set, the fallback is:

```powershell
https://adncapital.com.vn
```

Set the runtime URL before syncing if production uses another domain:

```powershell
$env:CAPACITOR_SERVER_URL="https://your-adn-domain.example"
npm run mobile:sync:android
```

## Debug APK

Debug APKs are automatically debug-signed by the Android SDK and are suitable for device testing:

```powershell
npm run mobile:apk:debug
```

Expected output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Release APK

Create a release keystore once:

```powershell
keytool -genkey -v -keystore android/release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias adn-capital
```

Create `android/keystore.properties` from `android/keystore.properties.example` and fill in the real passwords. Do not commit that file.

Then build:

```powershell
npm run mobile:apk:release
```

Expected output when a keystore is configured:

```text
android/app/build/outputs/apk/release/app-release.apk
```

## Android Studio

Open the generated Android project:

```powershell
npm run mobile:open:android
```

In Android Studio, open the `android/` directory, let Gradle sync finish, then use Build > Generate Signed App Bundle / APK for manual signing if preferred.

## Verification

```powershell
npm run verify:mobile:android
npm run build
```

Keep DNSE real submit disabled unless the ADN compliance gates have explicit sign-off.
