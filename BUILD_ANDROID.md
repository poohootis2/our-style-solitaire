# Our Style Solitaire 1.6.0 — 외부 환경 실행 및 Android APK 빌드

이 안내서는 압축 파일을 다른 컴퓨터로 옮긴 뒤 **Our Style Solitaire**를 실행하고, 휴대폰에 직접 설치할 수 있는 **APK**를 만드는 절차를 정리합니다. 휴대폰에는 Expo 또는 Expo Go를 설치할 필요가 없습니다. APK를 내려받아 설치하면 됩니다.

## 1. 필요한 개발 환경

| 항목 | 권장 버전 또는 도구 | 용도 |
| --- | --- | --- |
| Node.js | 22 LTS | JavaScript·Expo 도구 실행 |
| pnpm | 9.12 이상 | 프로젝트 의존성 설치 |
| Expo 계정 | 무료 계정 가능 | 클라우드 APK 빌드(EAS Build) |
| Android Studio + JDK | Android Studio 최신판 + JDK 17 | 로컬 Android 빌드 시 필요 |

프로젝트의 Android 앱 ID는 `com.app.ourstylesolitaire`, 버전은 `1.6.0`, Android 버전 코드는 `16`으로 설정되어 있습니다.

## 2. 프로젝트 압축 해제 및 기본 검증

터미널을 열어 다운로드한 ZIP 파일을 압축 해제한 뒤, 다음 명령을 실행합니다.

```sh
unzip Our-Style-Solitaire-v1.6.0-source.zip -d our-style-solitaire
cd our-style-solitaire

# Node.js에 포함된 Corepack으로 pnpm 버전을 준비합니다.
corepack enable
corepack prepare pnpm@9.12.0 --activate

# package.json과 pnpm-lock.yaml 기준으로 의존성을 설치합니다.
pnpm install --frozen-lockfile

# 코드 검증
pnpm check
pnpm test
pnpm lint
```

웹 미리보기로 먼저 확인하려면 다음 명령을 사용합니다.

```sh
pnpm dev
```

## 3. 권장 방식: EAS Build로 설치 가능한 APK 만들기

EAS Build는 Android 개발 도구를 로컬에 전부 설치하지 않고도 서명된 APK를 만드는 가장 간단한 방법입니다. Android에서 직접 설치할 파일은 기본 AAB가 아니라 `APK` 형식으로 빌드해야 합니다.[1]

먼저 Expo 계정에 로그인하고 프로젝트를 EAS에 연결합니다. 계정이 없다면 [Expo 가입 페이지](https://expo.dev/signup)에서 무료로 만들 수 있습니다.[2]

```sh
# 전역 설치 없이 최신 EAS CLI를 실행합니다.
npx eas-cli@latest login
npx eas-cli@latest whoami

# 최초 1회만 실행합니다. 질문이 나오면 Android 빌드를 선택합니다.
npx eas-cli@latest build:configure
```

프로젝트 루트에 생성된 `eas.json`을 아래 내용으로 교체하거나, `preview` 프로필을 추가합니다.

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

그 다음 APK 빌드를 시작합니다.

```sh
npx eas-cli@latest build --platform android --profile preview
```

처음 빌드할 때 Android 서명 키를 묻는다면 **Generate new keystore**를 선택하면 됩니다. 빌드가 끝나면 터미널과 빌드 상세 페이지에 표시되는 APK URL을 휴대폰으로 열어 다운로드하고 설치합니다.[2]

> `preview` 프로필의 `android.buildType: "apk"` 설정이 없으면 기본 출력물은 직접 설치할 수 없는 AAB일 수 있습니다.[1]

## 4. 휴대폰에 APK 설치하기

휴대폰에서 APK URL을 열고 파일을 내려받습니다. 설치가 차단되면 브라우저 또는 파일 관리자에 대해 **이 출처의 앱 설치 허용**을 켠 뒤 설치를 다시 누릅니다. 설치가 끝나면 홈 화면의 **Our Style Solitaire** 아이콘으로 실행합니다.

USB 연결 상태에서 컴퓨터로 설치하려면 Android SDK의 `adb`를 사용합니다.

```sh
adb devices
adb install -r path/to/our-style-solitaire.apk
```

`-r` 옵션은 기존에 설치된 동일 앱을 유지한 채 새 버전으로 교체합니다.

## 5. 대안: Android Studio에서 로컬 Debug APK 만들기

인터넷 빌드를 사용하지 않고 로컬에서 설치용 Debug APK를 만들 수도 있습니다. Android Studio에서 Android SDK와 JDK 17을 설치한 후, 환경 변수 `ANDROID_HOME`과 `JAVA_HOME`을 운영체제에 맞게 설정합니다.

```sh
cd our-style-solitaire
pnpm install --frozen-lockfile

# Expo 설정으로 Android 네이티브 프로젝트를 생성합니다.
npx expo prebuild --platform android

# Debug APK를 생성합니다.
cd android
./gradlew assembleDebug
```

생성 파일 경로는 다음과 같습니다.

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

해당 파일을 휴대폰으로 복사해 설치하거나, USB 연결 후 아래 명령으로 설치합니다.

```sh
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Debug APK는 개인 테스트용입니다. 외부 배포나 Google Play 등록에는 EAS Build의 `production` 프로필 또는 서명 설정이 완료된 Release 빌드를 사용해야 합니다.

## 6. 자주 쓰는 명령어

| 목적 | 명령어 |
| --- | --- |
| 의존성 설치 | `pnpm install --frozen-lockfile` |
| 웹 미리보기 실행 | `pnpm dev` |
| 타입 검사 | `pnpm check` |
| 게임 규칙 테스트 | `pnpm test` |
| 린트 검사 | `pnpm lint` |
| 설치용 APK 빌드 | `npx eas-cli@latest build --platform android --profile preview` |
| 최신 EAS 빌드 확인 | `npx eas-cli@latest build:list --platform android` |
| USB로 APK 설치 | `adb install -r path/to/file.apk` |

## 7. 문제 해결

| 증상 | 해결 방법 |
| --- | --- |
| `pnpm` 명령을 찾을 수 없음 | `corepack enable` 후 `corepack prepare pnpm@9.12.0 --activate`를 다시 실행합니다. |
| EAS 로그인 실패 | `npx eas-cli@latest logout` 후 `npx eas-cli@latest login`을 다시 실행합니다. |
| APK 대신 AAB가 생성됨 | `eas.json`의 `preview.android.buildType`이 정확히 `apk`인지 확인합니다. |
| 휴대폰 설치가 차단됨 | 다운로드한 브라우저 또는 파일 관리자에 대한 알 수 없는 앱 설치 권한을 허용합니다. |
| 로컬 Gradle 빌드 실패 | Android Studio SDK·Build Tools·JDK 17 경로와 `JAVA_HOME`, `ANDROID_HOME` 설정을 점검합니다. |

## References

[1]: https://docs.expo.dev/build-reference/apk/ "Expo: Build APKs for Android Emulators and devices"
[2]: https://docs.expo.dev/build/setup/ "Expo: Create your first build"
