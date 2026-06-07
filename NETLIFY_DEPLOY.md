# Netlify 배포 방법

## 드래그 앤 드롭으로 빠르게 배포

1. 터미널에서 앱 폴더로 이동합니다.
   ```bash
   cd /Users/yeolstudio/Documents/Codex/2026-06-05/new-chat-2/work/guitar-tuner
   npm run build
   ```

2. Netlify 사이트에 로그인합니다.
   - https://app.netlify.com/drop

3. `dist` 폴더를 Netlify 화면에 끌어다 놓습니다.

4. 배포가 끝나면 `https://...netlify.app` 주소가 생깁니다.

## GitHub 저장소로 연결해서 배포

Netlify에서 새 사이트를 만들 때 이 설정을 사용하세요.

- Base directory: 비워두기
- Build command: `npm run build`
- Publish directory: `dist`
- Node version: `22`

이 저장소 안에 있는 `netlify.toml`이 위 설정을 자동으로 알려줍니다.

## 마이크 사용 주의

기타 튜너의 마이크 기능은 HTTPS 주소에서 사용하는 것이 안전합니다. Netlify 배포 주소는 HTTPS라서 휴대폰이나 다른 컴퓨터에서도 마이크 권한을 허용하면 사용할 수 있습니다.
