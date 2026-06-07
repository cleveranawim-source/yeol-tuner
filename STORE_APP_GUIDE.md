# YEOL Tuner 스토어 출시 준비

이 프로젝트는 오프라인 웹앱(PWA)과 Android/iOS 앱(Capacitor)으로 준비되어 있습니다.

## 현재 출시 기본값

- 앱 이름: `YEOL Tuner`
- Bundle ID / Package ID: `com.yeolstudio.yeoltuner`
- Android 버전: `1.0`, versionCode `1`
- iOS 표시 이름: `YEOL Tuner`
- 필수 권한: 마이크
- 개인정보처리방침: 웹 배포 후 `https://배포주소/privacy.html`
- 수집 데이터: 없음
- 광고/분석 도구: 없음
- 오프라인 사용: 가능

## 오프라인 작동 방식

`vite-plugin-pwa`가 빌드 결과물을 캐시합니다. 앱을 한 번 설치하거나 실행한 뒤에는 인터넷 연결이 없어도 화면과 튜너 로직이 열립니다. 마이크 권한은 기기에서 허용해야 합니다.

## Android 앱 만들기

1. Android Studio를 설치합니다.
2. 아래 명령을 실행합니다.
   ```bash
   cd /Users/yeolstudio/Documents/Codex/2026-06-05/new-chat-2/work/guitar-tuner
   npm run cap:sync
   npm run android
   ```
3. Android Studio에서 release 빌드로 AAB를 만들고 Google Play Console에 등록합니다.

### Android AAB 만들기

Android Studio에서:

1. `Build > Generate Signed App Bundle / APK...`
2. `Android App Bundle` 선택
3. 기존 keystore 선택: `yeol-tuner-release.jks`
4. Build Variant: `release`
5. 생성된 `.aab`를 Google Play Console에 업로드

주의: `yeol-tuner-release.jks`와 비밀번호는 앱 업데이트에 필요합니다. GitHub에 올리지 않습니다.

## iPhone 앱 만들기

1. Mac에 Xcode를 설치합니다.
2. Apple Developer 계정이 필요합니다.
3. 아래 명령을 실행합니다.
   ```bash
   cd /Users/yeolstudio/Documents/Codex/2026-06-05/new-chat-2/work/guitar-tuner
   npm run cap:sync
   npm run ios
   ```
4. Xcode에서 Signing, Bundle Identifier, App Icon을 확인한 뒤 Archive로 App Store Connect에 업로드합니다.

### iOS Archive 만들기

Xcode에서:

1. `ios/App/App.xcodeproj` 열기
2. Target `App` 선택
3. `Signing & Capabilities`에서 유료 Apple Developer Team 선택
4. Bundle Identifier: `com.yeolstudio.yeoltuner`
5. 상단 실행 대상: `Any iOS Device (arm64)`
6. `Product > Archive`
7. Organizer에서 `Distribute App > App Store Connect > Upload`

## 스토어 등록 전 꼭 준비할 것

- 앱 아이콘 PNG 세트: 준비됨
- 스크린샷: Android/iPhone 실제 화면 캡처 필요
- 앱 설명: 아래 문구 사용 가능
- 개인정보 처리방침 URL: Vercel 배포 후 `/privacy.html`
- 마이크 사용 이유: 악기 음정을 감지하기 위해 마이크 입력을 사용합니다.
- 테스트: Android 실제 기기, iPhone 실제 기기에서 마이크 튜닝 확인

## 스토어 등록 문구 초안

### 짧은 설명

YEOL Tuner is a simple offline tuner for guitar, bass, violin, viola, cello, double bass, ukulele, mandolin, and banjo.

### 긴 설명

YEOL Tuner helps you tune string instruments with a clean, focused interface. It supports guitar, bass guitar, 5-string bass, violin, viola, cello, double bass, ukulele, mandolin, and banjo tunings.

The app detects pitch through your device microphone and shows clear tuning guidance such as whether to tune up, tune down, or stay on pitch. It is designed for simple everyday practice and can be used offline after installation.

Features:

- Supports multiple string instruments
- Auto and manual tuning modes
- Clear cents meter and tuning guidance
- Offline use after installation
- No ads and no analytics tracking

### 마이크 권한 설명

YEOL Tuner uses the microphone to detect instrument pitch for tuning. Audio is processed locally and is not recorded, stored, or shared.

## Google Play 데이터 보안 답변 기준

- Does the app collect or share user data? `No`
- Is all user data encrypted in transit? 해당 없음, 수집 데이터 없음
- Can users request data deletion? 해당 없음, 수집 데이터 없음
- Microphone permission purpose: instrument pitch detection
- Ads: `No`
- Analytics: `No`

## App Store Privacy 기준

- Data Collected: `No`
- Tracking: `No`
- Microphone usage description: `YEOL Tuner uses the microphone to detect instrument pitch for tuning.`
