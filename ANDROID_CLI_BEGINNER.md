# Android Studio 없이 명령어로 APK 만들기

이 안내서는 Expo EAS와 Android Studio 화면을 사용하지 않고, **Windows PowerShell 명령어만으로** Our Style Solitaire의 Debug APK를 만드는 방법입니다. APK 빌드에는 Expo 계정이 필요하지 않지만, Android 빌드 도구인 **Node.js, JDK 17, Android SDK Command-line Tools**는 필요합니다.

## 먼저 확인할 것

PowerShell을 열고 다음 세 명령을 입력합니다.

```powershell
node --version
java -version
sdkmanager --version
```

세 명령 모두 버전 숫자를 표시하면 바로 `프로젝트 빌드` 단계로 이동합니다. `java` 또는 `sdkmanager`를 찾을 수 없다고 나오면 아래의 `처음 한 번만 하는 도구 설치` 단계를 먼저 진행합니다.

## 처음 한 번만 하는 도구 설치

### Node.js

[Node.js 공식 사이트](https://nodejs.org/)에서 **LTS** 버전을 설치합니다. 설치가 끝나면 PowerShell을 닫고 새로 엽니다.

### JDK 17

JDK 17이 없다면 [Eclipse Adoptium](https://adoptium.net/temurin/releases/?version=17)에서 Windows x64용 Temurin 17을 설치합니다. 설치 프로그램에서 `JAVA_HOME`을 자동으로 설정하는 선택 항목이 보이면 선택합니다.

설치 후 PowerShell을 새로 열고 확인합니다.

```powershell
java -version
```

### Android SDK Command-line Tools

[Android Studio 공식 다운로드 페이지](https://developer.android.com/studio#command-tools)에서 **Command line tools only → Windows**를 내려받습니다. 압축을 다음 구조로 풉니다.

```text
C:\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat
```

PowerShell에서 현재 창에만 적용할 환경 변수를 설정합니다.

```powershell
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "C:\Android\Sdk"
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

Android SDK 라이선스에 동의하고 필요한 SDK를 설치합니다.

```powershell
sdkmanager.bat --licenses
sdkmanager.bat "platform-tools" "platforms;android-35" "build-tools;35.0.0"
```

프로젝트의 Expo SDK 54 Android 빌드가 요구하는 추가 패키지를 묻는 경우, 화면에 표시된 패키지 이름을 그대로 `sdkmanager.bat "패키지이름"`으로 설치합니다. `sdkmanager`가 계속 인식되지 않으면 반드시 새 PowerShell 창을 열고 환경 변수를 다시 설정합니다.

> 환경 변수를 컴퓨터를 다시 켠 뒤에도 유지하려면 Windows 검색에서 **환경 변수 편집**을 열어 사용자 변수에 `ANDROID_HOME=C:\Android\Sdk`, `ANDROID_SDK_ROOT=C:\Android\Sdk`를 추가하고 Path에 `C:\Android\Sdk\platform-tools`와 `C:\Android\Sdk\cmdline-tools\latest\bin`을 추가합니다.

## 프로젝트 빌드

### 1. ZIP 압축 해제

`Our-Style-Solitaire-v1.6.0-source.zip`을 바탕화면에 압축 해제합니다. `package.json`이 바로 보이는 폴더를 프로젝트 폴더로 사용합니다.

### 2. PowerShell을 프로젝트 폴더에서 열기

`package.json`이 보이는 폴더의 빈 공간에서 마우스 오른쪽 버튼을 누르고 **터미널에서 열기**를 선택합니다. 아래 명령으로 현재 위치를 확인합니다.

```powershell
Get-ChildItem package.json
```

파일이 보이면 올바른 위치입니다. 파일을 찾을 수 없으면 `cd` 명령으로 프로젝트 폴더로 이동합니다.

### 3. 의존성 설치

이 로컬 빌드에서는 Windows 네이티브 자동 연결 문제를 줄이기 위해 `npm`을 사용합니다.

```powershell
npm install
```

설치가 끝난 뒤 다음 명령으로 코드 오류를 확인합니다.

```powershell
npx tsc --noEmit
```

### 4. Android 폴더 생성

이 프로젝트의 ZIP에는 Android 네이티브 폴더가 포함되어 있지 않으므로, 다음 명령으로 생성합니다.

```powershell
npx expo prebuild --clean --platform android
```

완료되면 프로젝트 폴더 안에 `android` 폴더가 생깁니다. 이 명령은 Expo 계정이나 EAS 빌드를 사용하지 않습니다.

### 5. Gradle로 APK 생성

다음 명령을 그대로 입력합니다.

```powershell
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug --no-daemon
```

빌드가 성공하면 마지막에 `BUILD SUCCESSFUL`이 표시됩니다. APK의 위치는 다음과 같습니다.

```text
프로젝트폴더\android\app\build\outputs\apk\debug\app-debug.apk
```

찾기 쉽게 바탕화면에 복사하려면 프로젝트 루트로 돌아와 다음 명령을 실행합니다.

```powershell
Copy-Item .\android\app\build\outputs\apk\debug\app-debug.apk "$env:USERPROFILE\Desktop\Our-Style-Solitaire-1.6.0.apk"
```

## 휴대폰에 설치하기

가장 쉬운 방법은 바탕화면의 `Our-Style-Solitaire-1.6.0.apk`를 USB 케이블이나 Google Drive로 휴대폰에 보내고, 휴대폰에서 파일을 눌러 설치하는 것입니다. 설치가 차단되면 APK를 열었던 브라우저 또는 파일 앱의 **이 출처의 앱 설치 허용**을 켭니다.

USB 디버깅을 사용하는 경우 Android SDK의 `adb`가 설치되어 있으므로 다음처럼 실행할 수 있습니다.

```powershell
adb devices
adb install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

휴대폰 화면에 USB 디버깅 허용 창이 나오면 **허용**을 누릅니다.

## 다음에 APK를 다시 만들 때

코드를 수정하지 않고 APK만 다시 만들 때는 프로젝트 루트에서 다음만 실행하면 됩니다.

```powershell
cd 프로젝트폴더
cd android
.\gradlew.bat assembleDebug --no-daemon
```

`package.json`의 네이티브 패키지를 변경했거나 앱 설정·아이콘을 변경한 경우에는 프로젝트 루트에서 다음을 먼저 실행합니다.

```powershell
npm install
npx expo prebuild --clean --platform android
cd android
.\gradlew.bat assembleDebug --no-daemon
```

## 오류가 발생했을 때

| 오류 | 해결 |
| --- | --- |
| `node is not recognized` | Node.js LTS를 설치하고 PowerShell을 새로 엽니다. |
| `java is not recognized` | JDK 17을 설치하고 `JAVA_HOME`을 확인합니다. |
| `sdkmanager is not recognized` | `$env:ANDROID_HOME`과 Path 설정을 다시 실행하고 PowerShell을 새로 엽니다. |
| `SDK location not found` | `C:\Android\Sdk`가 실제 SDK 경로인지 확인하고 `ANDROID_HOME`을 다시 설정합니다. |
| `No matching variant`가 여러 React Native 모듈에서 발생 | Android Studio를 닫고 `android`와 `node_modules`를 삭제한 뒤 `npm install` 및 `npx expo prebuild --clean --platform android`를 다시 실행합니다. |
| `BUILD FAILED`와 Java 오류가 발생 | JDK 17을 사용 중인지 확인합니다. `java -version`이 17이어야 합니다. |
| APK 파일을 찾을 수 없음 | `android\app\build\outputs\apk\debug\app-debug.apk` 경로를 직접 확인합니다. |
| 휴대폰 설치가 차단됨 | 해당 브라우저 또는 파일 앱의 알 수 없는 앱 설치 권한을 허용합니다. |

## 핵심 명령어만 보기

```powershell
# 프로젝트 루트에서
npm install
npx expo prebuild --clean --platform android
cd android
.\gradlew.bat clean
.\gradlew.bat assembleDebug --no-daemon

# 결과 파일
# android\app\build\outputs\apk\debug\app-debug.apk
```

이 방식으로 만든 Debug APK는 개인 휴대폰 테스트용입니다. Google Play 등록용 Release APK는 별도의 서명 키 설정이 필요합니다.
