# YEOL Tuner 스토어 앱 준비

이 프로젝트는 오프라인 웹앱(PWA)과 Android/iOS 앱(Capacitor)으로 준비되어 있습니다.

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

## 스토어 등록 전 꼭 준비할 것

- 앱 아이콘 PNG 세트
- 스크린샷
- 앱 설명
- 개인정보 처리방침 URL
- 마이크 사용 이유: 악기 음정을 감지하기 위해 마이크 입력을 사용합니다.
- 테스트: Android 실제 기기, iPhone 실제 기기에서 마이크 튜닝 확인
