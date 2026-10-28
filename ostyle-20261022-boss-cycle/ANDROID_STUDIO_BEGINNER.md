# Our Style Solitaire APK 만들기 — 초보자용 순서

이 문서는 Expo EAS 한도 없이 **Android Studio에서 직접 APK를 만드는 전체 과정**입니다. 휴대폰에는 Expo나 Expo Go를 설치하지 않습니다. 마지막에 만들어지는 `app-debug.apk` 파일만 휴대폰에 설치합니다.

## 전체 순서 한눈에 보기

```text
1. Node.js 설치
2. Android Studio 설치 및 SDK 확인
3. ZIP 압축 해제
4. 프로젝트 폴더에서 명령어 실행
5. Android Studio에서 android 폴더 열기
6. APK 생성
7. APK를 휴대폰으로 옮겨 설치
```

## 1단계: Node.js 설치

컴퓨터에 Node.js가 없으면 [Node.js 공식 홈페이지](https://nodejs.org/)에서 **LTS**라고 표시된 버전을 설치합니다. 설치 화면은 기본값 그대로 진행하면 됩니다.

설치가 끝났는지 확인하려면 Windows 시작 메뉴에서 **PowerShell**을 검색해 실행하고 다음 명령을 입력합니다.

```powershell
node --version
npm --version
```

각 명령 뒤에 버전 숫자가 나오면 정상입니다. 숫자가 나오지 않으면 컴퓨터를 한 번 재부팅한 뒤 다시 확인합니다.

## 2단계: Android Studio 설치 확인

Android Studio가 이미 있다면 이 단계의 설치는 건너뛰고 SDK만 확인합니다. Android Studio가 없다면 [Android Studio 공식 홈페이지](https://developer.android.com/studio)에서 설치합니다.

Android Studio를 열고 시작 화면에서 **More Actions → SDK Manager**를 누릅니다. 다음 항목에 체크가 되어 있는지 확인합니다.

| 항목 | 필요한 상태 |
| --- | --- |
| Android SDK Platform 35 이상 | 설치됨 |
| Android SDK Build-Tools | 설치됨 |
| Android SDK Platform-Tools | 설치됨 |
| Android SDK Command-line Tools | 설치됨 |

없는 항목은 체크하고 **Apply → OK**를 눌러 설치합니다. 설치가 끝나면 Android Studio를 닫아도 됩니다.

## 3단계: ZIP 압축 해제

다운로드한 `Our-Style-Solitaire-v1.6.0-source.zip` 파일을 바탕화면에 둡니다. 파일을 마우스 오른쪽 버튼으로 클릭하고 **압축 풀기**를 선택합니다.

압축을 푼 폴더를 열었을 때 아래 항목들이 보여야 합니다.

```text
package.json
pnpm-lock.yaml
app
assets
app.config.ts
```

`package.json`이 바로 보이지 않고 폴더 안에 또 다른 폴더가 있다면, `package.json`이 보이는 가장 안쪽 폴더를 사용합니다.

## 4단계: 프로젝트 폴더에서 명령어 실행

`package.json`이 보이는 폴더의 빈 공간에서 마우스 오른쪽 버튼을 누르고 **터미널에서 열기** 또는 **Open in Terminal**을 선택합니다.

검은색 또는 파란색 터미널 창에 아래 명령을 한 줄씩 입력하고, 각 줄마다 Enter를 누릅니다.

```powershell
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check`가 끝났을 때 빨간색 오류가 없으면 다음 명령을 실행합니다.

```powershell
npx expo prebuild --platform android
```

이 명령이 끝나면 프로젝트 폴더 안에 다음과 같은 `android` 폴더가 새로 생깁니다.

```text
Our-Style-Solitaire
├─ app
├─ assets
├─ android       ← 새로 생성됨
├─ package.json
└─ app.config.ts
```

> `npx expo prebuild`는 Expo 계정에 로그인하지 않습니다. Android Studio가 열 수 있는 네이티브 Android 프로젝트를 만들어 주는 단계입니다.

### 명령어 오류가 나올 때

`corepack`을 찾을 수 없다는 메시지가 나오면 아래 명령으로 pnpm을 설치한 뒤 나머지 명령을 실행합니다.

```powershell
npm install --global pnpm@9.12.0
pnpm install --frozen-lockfile
pnpm check
npx expo prebuild --platform android
```

## 5단계: Android Studio에서 프로젝트 열기

Android Studio를 실행하고 시작 화면에서 **Open**을 누릅니다. 프로젝트 전체 폴더가 아니라, 방금 생성된 `android` 폴더를 선택합니다.

```text
바탕화면\Our-Style-Solitaire\android
```

Android Studio 아래쪽에 Gradle 동기화 작업이 표시됩니다. 처음에는 필요한 파일을 내려받으므로 몇 분 정도 기다립니다. 아래쪽에 **Gradle sync finished**와 비슷한 완료 문구가 나오면 다음 단계로 갑니다.

Java 오류가 나오면 Android Studio 메뉴에서 다음 위치를 엽니다.

```text
File → Settings → Build, Execution, Deployment → Build Tools → Gradle
```

**Gradle JDK**를 `Embedded JDK` 또는 `jbr-17`로 선택하고 **Apply → OK**를 누릅니다. 그 다음 **File → Sync Project with Gradle Files**를 누릅니다.

## 6단계: APK 만들기

Android Studio 위쪽 메뉴에서 다음 순서로 선택합니다.

```text
Build
→ Generate App Bundles or APKs
→ Generate APKs
```

Android Studio 버전에 따라 메뉴가 짧게 **Build APK(s)**로 표시될 수도 있습니다. 이 경우 **Build APK(s)**를 누릅니다.

빌드가 끝나면 오른쪽 아래에 **locate** 링크가 나타납니다. `locate`를 누르면 다음 파일이 보입니다.

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

이 파일이 휴대폰에 직접 설치하는 APK입니다. 파일을 바탕화면이나 다운로드 폴더로 복사해 두면 찾기 쉽습니다.

## 7단계: 휴대폰에 APK 설치

`app-debug.apk` 파일을 휴대폰으로 보냅니다. USB 케이블, 이메일, Google Drive, 카카오톡 중 편한 방법을 사용하면 됩니다.

휴대폰에서 APK 파일을 누릅니다. 설치가 차단되면 안내 화면에서 **설정**을 누르고, APK를 열었던 브라우저 또는 파일 앱의 **이 출처의 앱 설치 허용**을 켭니다. 뒤로 돌아와 APK를 다시 누르면 설치됩니다.

설치가 끝나면 앱 목록에서 **Our Style Solitaire**를 찾아 실행합니다.

## 8단계: 다음에 새 APK를 만들 때

코드를 새로 받은 경우에는 프로젝트 폴더에서 다음 명령만 다시 실행합니다.

```powershell
pnpm install --frozen-lockfile
npx expo prebuild --platform android
```

그 후 Android Studio에서 `android` 폴더를 열고 **Build → Generate App Bundles or APKs → Generate APKs**를 누릅니다.

코드를 수정하지 않고 APK만 다시 만들 때는 `prebuild`를 다시 실행할 필요 없이 Android Studio에서 APK를 바로 생성하면 됩니다.

## 9단계: 가장 흔한 문제 해결

| 화면에 나오는 문제 | 해결 방법 |
| --- | --- |
| `node`를 찾을 수 없음 | Node.js LTS를 설치한 뒤 PowerShell을 닫고 새로 엽니다. |
| `pnpm`을 찾을 수 없음 | `npm install --global pnpm@9.12.0`을 실행합니다. |
| `package.json`을 찾을 수 없음 | 명령어를 압축 해제한 최상위 폴더가 아니라 `package.json`이 보이는 폴더에서 실행합니다. |
| Gradle JDK 오류 | Android Studio 설정에서 Gradle JDK를 Embedded JDK 또는 jbr-17로 선택합니다. |
| APK가 보이지 않음 | `android\app\build\outputs\apk\debug\app-debug.apk` 경로를 직접 확인합니다. |
| 휴대폰 설치가 차단됨 | APK를 연 브라우저 또는 파일 앱의 알 수 없는 앱 설치 권한을 허용합니다. |
| 휴대폰에서 앱이 이전 상태로 보임 | 새 APK를 설치할 때 기존 앱을 삭제하지 말고 설치합니다. 저장된 게임 상태가 유지될 수 있습니다. |

## 성공 여부 확인표

| 확인할 내용 | 완료 기준 |
| --- | --- |
| Node.js | `node --version`에 숫자가 표시됨 |
| 의존성 설치 | `pnpm install --frozen-lockfile`이 오류 없이 끝남 |
| Android 폴더 | `npx expo prebuild --platform android` 후 `android` 폴더가 생김 |
| APK 빌드 | Android Studio에 APK 생성 완료 표시가 나옴 |
| APK 위치 | `android/app/build/outputs/apk/debug/app-debug.apk`가 존재함 |
| 휴대폰 설치 | 홈 화면 또는 앱 목록에 Our Style Solitaire이 표시됨 |
