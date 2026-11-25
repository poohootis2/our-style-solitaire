# Monster Solitaire 홍보 웹사이트

이 폴더는 Android 앱과 분리된 정적 홍보 사이트입니다. 앱 버전, Android 폴더, 서명키, Render API 코드는 사용하지 않습니다.

## Vercel 연결 방법

### 방법 A: GitHub 저장소를 새 Vercel 프로젝트로 연결

1. Vercel 대시보드에서 **Add New → Project**를 선택합니다.
2. `poohootis2/our-style-solitaire` 저장소를 선택합니다.
3. 프로젝트 이름은 예를 들어 `monster-solitaire-site`로 지정합니다.
4. **Root Directory**를 `website`로 지정합니다.
5. Framework Preset은 `Other`로 둡니다.
6. Build Command는 비워 두거나 `None`으로 둡니다.
7. Output Directory는 비워 둡니다. `website` 자체가 루트가 됩니다.
8. Deploy를 누릅니다.

이렇게 하면 기존 Render API와 별도의 Vercel 프로젝트가 생성됩니다. 기존 API 프로젝트의 환경변수나 도메인은 변경하지 마세요.

### 방법 B: Vercel CLI

PowerShell에서 프로젝트 루트가 아닌 website 폴더에서 실행합니다.

```powershell
cd F:\game_make\our-style-solitaire4\website
npx vercel
npx vercel --prod
```

처음 실행할 때 팀과 프로젝트를 선택하라는 질문이 나옵니다. 새 프로젝트 이름을 `monster-solitaire-site`처럼 지정하세요. 기존 API 프로젝트를 선택하지 않는 것이 안전합니다.

## AdSense 적용 시점

사이트가 공개된 뒤 AdSense에 실제 사이트 주소를 등록하고 검토를 요청합니다. 승인 전에는 실제 광고 코드를 활성화하지 않습니다. 승인 후 `index.html`의 주석 부분에서 `ca-pub-XXXXXXXXXXXXXXX`를 실제 게시자 ID로 교체하고 광고 단위 코드를 추가합니다.

광고는 게임 조작 버튼처럼 보이지 않도록 현재의 독립된 점선 광고 영역에만 배치하세요. 게임 카드·다운로드 버튼·이미지와 겹치게 배치하지 않습니다.
