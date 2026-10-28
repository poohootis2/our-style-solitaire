# Our Style Solitaire 1.6.0 — Android Studio로 APK 만들기

이 문서는 **Expo EAS Build를 사용하지 않고** Windows 컴퓨터의 Android Studio에서 직접 설치용 APK를 만드는 방법을 설명합니다. Expo 계정, Expo Go, EAS 빌드 한도가 필요하지 않습니다. 휴대폰에는 최종적으로 APK 파일만 설치하면 됩니다.

> 가장 쉬운 순서는 `압축 해제 → 프로그램 설치 → 명령어 4줄 실행 → Android Studio에서 APK 생성`입니다. 아래 명령어는 복사해서 그대로 붙여넣으면 됩니다.

## 1. 먼저 준비할 것

| 준비 항목 | 권장 사항 | 설명 |
| --- | --- | --- |
| Windows 컴퓨터 | Windows 10 또는 11, 여유 공간 15GB 이상 | Android Studio와 Android SDK 설치 공간 |
| Node.js | 22 LTS | Expo 프로젝트를 Android 프로젝트로 변환할 때 사용 |
| Android Studio | 최신 안정 버전 | Android APK 생성 프로그램 |
| Java | Android Studio의 Embedded JDK 17 | Gradle Android 빌드에 사용 |
| 휴대폰 | Android, USB 케이블 또는 파일 전송 | APK 설치와 테스트 |

## 2. Android Studio 설치

[Android Studio 공식 다운로드 페이지](https://developer.android.com/studio)에서 설치 파일을 내려받아 설치합니다. 설치 과정에서 기본 선택 항목인 **Android SDK**, **Android SDK Platform**, **Android Virtual Device**를 모두 선택합니다.

설치가 끝나면 Android Studio를 한 번 실행합니다. 처음 설정 화면이 나오면 **Standard**를 선택하고 기본 설정으로 완료합니다.

Android Studio 상단 메뉴에서 **Tools → SDK Manager**를 열어 다음 항목이 설치되어 있는지 확인합니다.

| SDK Manager 항목 | 필요한 상태 |
| --- | --- |
| Android SDK Platform 35 이상 | 설치됨 |
| Android SDK Build-Tools | 설치됨 |
| Android SDK Command-line Tools | 설치됨 |
| Android SDK Platform-Tools | 설치됨 |

설치되어 있지 않은 항목은 체크한 뒤 **Apply**를 눌러 설치합니다. Android Studio에 포함된 Java를 사용하므로 별도의 Java 설치는 보통 필요하지 않습니다.

## 3. Node.js 설치

[Node.js 공식 사이트](https://nodejs.org/)에서 **LTS 버전**을 설치합니다. 설치가 끝나면 Windows에서 **PowerShell**을 엽니다.

Node.js가 정상 설치되었는지 다음 명령으로 확인합니다.

```powershell
node --version
npm --version
```

두 명령 모두 숫자로 된 버전을 보여주면 정상입니다.

## 4. ZIP 압축 해제

다운로드한 `Our-Style-Solitaire-v1.6.0-source.zip` 파일을 바탕화면이나 문서 폴더에 압축 해제합니다. 압축 해제된 폴더 안에 `package.json`, `app`, `assets`, `app.config.ts`가 보여야 합니다.

압축 해제된 프로젝트 폴더 안에서 마우스 오른쪽 버튼을 누른 뒤 **터미널에서 열기** 또는 **PowerShell에서 열기**를 선택합니다. 아래 명령을 순서대로 실행합니다.

```powershell
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 마지막에 오류가 없으면 다음 단계로 진행합니다. 이 프로젝트는 ZIP에 Android 네이티브 폴더를 포함하지 않으므로, 아래 명령으로 한 번 생성합니다.

```powershell
npx expo prebuild --platform android
```

이 명령은 **APK를 만드는 명령이 아니라 Android Studio가 열 수 있는 `android` 폴더를 생성하는 명령**입니다. Expo 계정 로그인은 필요하지 않습니다.

## 5. Android Studio에서 프로젝트 열기

Android Studio를 실행하고 시작 화면에서 **Open**을 누릅니다. 프로젝트 전체 폴더가 아니라 방금 생성된 다음 폴더를 선택합니다.

```text
our-style-solitaire\android
```

Android Studio가 Gradle 파일을 읽고 동기화하는 동안 기다립니다. 아래쪽에 **Gradle sync finished**와 비슷한 완료 표시가 나오면 다음 단계로 진행합니다. 처음에는 필요한 Gradle 파일을 내려받기 때문에 시간이 걸릴 수 있습니다.

## 6. APK 파일 생성하기

Android Studio 상단 메뉴에서 다음 순서로 선택합니다.

```text
Build
→ Generate App Bundles or APKs
→ Generate APKs
```

메뉴 이름이 조금 다르면 **Build → Build APK(s)**를 선택해도 됩니다. Debug APK 생성이 완료되면 오른쪽 아래에 **locate** 링크가 나타납니다. 링크를 누르면 다음 위치의 파일이 열립니다.

```text
our-style-solitaire\android\app\build\outputs\apk\debug\app-debug.apk
```

이 `app-debug.apk` 파일이 휴대폰에 직접 설치할 수 있는 APK입니다. 파일을 카카오톡, 이메일, USB 케이블, 또는 Google Drive로 휴대폰에 옮길 수 있습니다.

## 7. 휴대폰에 설치하기

휴대폰에서 APK 파일을 누릅니다. 설치가 차단되면 설정 화면에서 현재 파일을 열어본 브라우저 또는 파일 관리자에 대해 **이 출처의 앱 설치 허용**을 켭니다. 다시 APK 파일을 누르고 설치합니다.

설치가 끝나면 앱 목록에서 **Our Style Solitaire**를 실행합니다. 이 방식은 Expo Go가 필요하지 않습니다.

USB 케이블로 컴퓨터에서 바로 설치하려면 Android Studio 설치와 함께 제공되는 `adb`를 사용합니다.

```powershell
adb devices
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

휴대폰에 **USB 디버깅 허용** 창이 나타나면 허용을 누릅니다.

## 8. 다음 버전 APK를 다시 만들 때

코드를 수정한 뒤에는 프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
pnpm install --frozen-lockfile
npx expo prebuild --platform android
```

그 다음 Android Studio에서 `our-style-solitaire\android` 폴더를 다시 열고, **Build → Generate APKs**를 실행합니다. 이미 `android` 폴더가 있다면 `prebuild`가 기존 네이티브 파일을 덮어쓸 수 있으므로, 코드 수정 없이 APK만 다시 만들 때는 Android Studio 메뉴에서 바로 APK를 생성하면 됩니다.

## 9. 자주 발생하는 문제

| 문제 | 해결 방법 |
| --- | --- |
| `pnpm`을 찾을 수 없음 | `corepack enable`을 다시 실행한 뒤 PowerShell을 새로 엽니다. |
| `npx expo prebuild`가 실패함 | Node.js LTS가 설치되어 있는지 확인하고 프로젝트 루트에서 실행합니다. 루트에는 `package.json`이 있어야 합니다. |
| Gradle Sync 실패 | Android Studio의 SDK Manager에서 Platform 35, Build-Tools, Platform-Tools를 설치하고 다시 Sync합니다. |
| Java 또는 JDK 오류 | Android Studio의 Settings → Build Tools → Gradle에서 **Gradle JDK**를 Embedded JDK로 선택합니다. |
| APK 설치가 차단됨 | 휴대폰 설정에서 현재 브라우저 또는 파일 관리자에 대한 알 수 없는 앱 설치를 허용합니다. |
| `adb devices`에 기기가 없음 | USB 디버깅을 켜고, 데이터 전송이 가능한 USB 케이블을 사용하며, 휴대폰의 허용 창을 승인합니다. |
| 카드 배경이나 사운드가 안 보임 | Android Studio에서 반드시 프로젝트의 `android` 폴더를 열고 다시 APK를 생성합니다. `assets`가 포함된 프로젝트 루트에서 prebuild를 실행해야 합니다. |

## 핵심 명령어만 다시 보기

```powershell
# 프로젝트 폴더에서 실행
corepack enable
corepack prepare pnpm@9.12.0 --activate
pnpm install --frozen-lockfile
pnpm check
npx expo prebuild --platform android

# APK 생성은 Android Studio에서
# Build → Generate App Bundles or APKs → Generate APKs
```

> 이 프로젝트의 설치용 테스트 APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다. 개인 휴대폰 테스트에는 Debug APK로 충분하며, Google Play 등록용 Release 서명 APK는 별도의 서명 설정이 필요합니다.

## 참고 자료

[Android Studio 공식 다운로드](https://developer.android.com/studio)

[Expo Prebuild 공식 문서](https://docs.expo.dev/workflow/prebuild/)

[Expo Android APK 참고 문서](https://docs.expo.dev/build-reference/apk/)
