# Our Style Solitaire — Google Play 등록 초보자 안내서

## 먼저 알아둘 점

Expo EAS를 사용하지 않아도 Windows에서 직접 Android App Bundle(`.aab`)을 만들어 Google Play Console에 업로드할 수 있습니다. Google Play 신규 앱은 APK가 아니라 **AAB 파일**을 준비하는 것이 기본이며, 새 앱은 Play App Signing 등록이 필요합니다.

현재 앱의 Android 패키지명은 `com.app.ourstylesolitaire`입니다. Google Play에서 앱을 처음 만들 때 이 이름을 사용해야 하며, 앱을 만든 뒤에는 패키지명을 바꿀 수 없습니다. 현재 버전은 `1.6.0`, versionCode는 `16`입니다.

2026년 8월 31일부터 Google Play 신규 앱과 업데이트는 Android 16(API 36) 이상을 타깃으로 제출해야 하므로 프로젝트에 `compileSdkVersion: 36`과 `targetSdkVersion: 36`을 지정해 두었습니다.

## 1. Google Play Console 개발자 계정 만들기

브라우저에서 [Google Play Console](https://play.google.com/console/signup)에 접속해 Google 계정으로 개발자 계정을 만듭니다. 등록 과정에서 개발자 계정 확인과 연락처 확인이 필요할 수 있습니다. Google의 안내에 따라 등록 절차를 완료합니다.

개인 개발자 계정이 2023년 11월 13일 이후에 만들어졌다면, 일반 공개 전에 비공개 테스트를 진행해야 할 수 있습니다. Google은 최소 12명의 테스터가 14일 이상 계속 테스트에 참여하도록 요구합니다. 이 요건은 계정 유형과 생성 시점에 따라 달라질 수 있으므로 Play Console에 표시되는 안내를 우선 따릅니다.

## 2. 프로젝트 폴더에서 버전 확인

PowerShell을 열고 다음 폴더로 이동합니다.

```powershell
cd "E:\game_make\Our-Style-Solitaire-v1.6.0-source"
```

이 폴더 안에 `package.json`, `app.config.ts`, `app` 폴더가 보여야 합니다.

## 3. 업로드 키 한 번만 만들기

업로드 키는 Google Play에 업데이트를 올릴 때 계속 사용하는 중요한 파일입니다. 한 번 만든 뒤 안전한 곳에 두 개의 백업을 보관하고, 비밀번호를 잊지 마세요. 키 파일이나 비밀번호를 다른 사람에게 보내지 마세요.

PowerShell에서 다음을 실행합니다.

```powershell
keytool -genkeypair -v -storetype PKCS12 `
  -keystore upload-keystore.jks `
  -alias upload `
  -keyalg RSA -keysize 2048 -validity 10000
```

이 명령은 현재 프로젝트 최상위 폴더에 `upload-keystore.jks`를 만듭니다. `keytool`을 찾을 수 없다는 메시지가 나오면 JDK 17이 설치되지 않았거나 `JAVA_HOME`이 설정되지 않은 것입니다.

## 4. Android 릴리즈 서명 설정

먼저 네이티브 Android 폴더를 생성합니다. 이전에 생성된 폴더가 있어도 같은 명령으로 최신 설정을 반영할 수 있습니다.

```powershell
npx expo prebuild --clean --platform android
```

그 다음 키 파일을 Android 앱 폴더로 복사합니다.

```powershell
Copy-Item .\upload-keystore.jks .\android\app\upload-keystore.jks -Force
```

메모장으로 다음 파일을 엽니다.

```powershell
notepad .\android\gradle.properties
```

파일 맨 아래에 아래 내용을 추가합니다. `여기에_입력` 부분은 키를 만들 때 직접 정한 비밀번호로 바꿉니다.

```properties
MYAPP_UPLOAD_STORE_FILE=upload-keystore.jks
MYAPP_UPLOAD_KEY_ALIAS=upload
MYAPP_UPLOAD_STORE_PASSWORD=여기에_키스토어_비밀번호
MYAPP_UPLOAD_KEY_PASSWORD=여기에_키_비밀번호
```

다음 파일을 엽니다.

```powershell
notepad .\android\app\build.gradle
```

`android {` 블록 안의 `signingConfigs`에 release 설정이 없으면 다음과 같이 추가하고, `buildTypes`의 `release`가 이 설정을 사용하도록 합니다.

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

이미 `signingConfigs` 또는 `buildTypes` 블록이 있다면 같은 이름의 블록을 새로 만들지 말고 기존 블록 안에 release 내용을 합칩니다. 잘못 붙여넣어 Gradle 오류가 나오면 해당 파일을 저장하지 말고 오류 화면 내용을 확인합니다.

`android/gradle.properties`와 키 파일은 외부에 공개하면 안 됩니다. 프로젝트를 GitHub 등에 올릴 경우 다음 두 줄을 `.gitignore`에 추가합니다.

```text
android/app/upload-keystore.jks
upload-keystore.jks
```

## 5. AAB 빌드하기

프로젝트 폴더에서 다음 명령을 실행합니다.

```powershell
cd "E:\game_make\Our-Style-Solitaire-v1.6.0-source\android"
.\gradlew.bat clean
.\gradlew.bat bundleRelease --no-daemon
```

성공하면 다음 파일이 생성됩니다.

```text
E:\game_make\Our-Style-Solitaire-v1.6.0-source\android\app\build\outputs\bundle\release\app-release.aab
```

파일이 실제로 생성되었는지 확인하려면 다음을 실행합니다.

```powershell
Test-Path "E:\game_make\Our-Style-Solitaire-v1.6.0-source\android\app\build\outputs\bundle\release\app-release.aab"
```

결과가 `True`이면 업로드할 AAB가 준비된 것입니다.

## 6. 휴대폰에서 먼저 릴리즈 버전 테스트하기

AAB는 일반적으로 Play Console에서 기기별 APK로 변환되어 배포됩니다. USB로 직접 설치해 테스트하려면 별도의 release APK도 만들 수 있습니다.

```powershell
.\gradlew.bat assembleRelease --no-daemon
```

APK 위치는 다음과 같습니다.

```text
E:\game_make\Our-Style-Solitaire-v1.6.0-source\android\app\build\outputs\apk\release\app-release.apk
```

이 릴리즈 APK는 Metro 서버나 USB 디버깅 없이 실행할 수 있습니다.

## 7. Play Console에서 앱 만들기

Play Console에서 `모든 앱` 또는 `앱 만들기`를 선택합니다. 앱 이름은 `Our Style Solitaire`, 기본 언어는 원하는 언어를 선택하고 앱 유형은 `게임`, 무료/유료 여부는 실제 배포 계획에 맞게 선택합니다. 패키지명은 로컬 빌드의 `com.app.ourstylesolitaire`와 일치해야 합니다.

앱 대시보드에서 다음 항목을 순서대로 작성합니다.

| 항목 | 준비할 내용 |
|---|---|
| 기본 스토어 등록정보 | 앱 이름, 짧은 설명, 전체 설명, 앱 아이콘, 스크린샷 |
| 앱 콘텐츠 | 개인정보처리방침, 광고 여부, 대상 연령, 콘텐츠 등급, 데이터 보안 설문 |
| 테스트 | 내부 테스트 또는 비공개 테스트 트랙 |
| 프로덕션 | 검토가 끝난 AAB를 공개 출시 트랙에 제출 |

개인정보처리방침 URL은 실제로 접근 가능한 웹페이지여야 합니다. 앱이 기기에 게임 상태를 저장하는 것과 외부 서버로 개인정보를 전송하는 것은 다르므로, 데이터 보안 설문은 최종 앱과 포함된 라이브러리의 실제 동작을 확인한 뒤 정확하게 작성합니다.

## 8. AAB 업로드

Play Console에서 `테스트 및 출시` → `테스트` → `내부 테스트`를 먼저 선택하는 것을 권장합니다. 새 릴리즈를 만들고 다음 파일을 업로드합니다.

```text
android\app\build\outputs\bundle\release\app-release.aab
```

Play Console이 오류나 경고를 표시하면 해당 문구를 확인합니다. versionCode가 이미 사용된 번호라고 나오면 `app.config.ts`의 Android `versionCode`를 17, 18처럼 증가시키고 다시 `npx expo prebuild --clean --platform android` 후 AAB를 빌드합니다.

처음 업로드할 때 Play App Signing 등록 화면이 나오면 안내에 따라 등록합니다. 업로드 키와 Google Play 앱 서명 키는 구분될 수 있으므로, Play Console에서 제공하는 안내를 따릅니다.

## 9. 내부 테스트 후 공개 출시

AAB를 내부 테스트 트랙에 올린 뒤 본인 휴대폰에 설치해 다음을 확인합니다.

게임 시작, 새 게임, 카드 이동, 힌트, 실행 취소, 사운드, 화면 접기·펼치기, 앱 종료 후 자동 복원, 하단 홈바와의 겹침을 점검합니다. 문제가 없으면 비공개 테스트로 이동합니다.

새 개인 계정에 비공개 테스트 요건이 적용되는 경우 Play Console이 요구하는 테스터 수와 기간을 충족한 뒤 `프로덕션 액세스 신청`을 진행합니다. Google의 승인을 받은 뒤 프로덕션 트랙에서 국가·지역을 선택하고 출시 검토를 제출합니다.

## 다음 업데이트부터의 순서

업데이트할 때는 먼저 `app.config.ts`의 버전을 올리고, Android `versionCode`를 이전보다 큰 숫자로 올립니다. 그 후 다음을 실행합니다.

```powershell
cd "E:\game_make\Our-Style-Solitaire-v1.6.0-source"
npx expo prebuild --clean --platform android
cd android
.\gradlew.bat bundleRelease --no-daemon
```

새 AAB는 같은 경로에 생성되며, 매번 더 큰 versionCode가 필요합니다. 업로드 키는 새로 만들지 말고 최초에 만든 키를 계속 사용합니다.

## 공식 참고자료

- [Google Play 타깃 API 요건](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Android App Bundle 업로드](https://developer.android.com/studio/publish/upload-bundle)
- [개인 개발자 계정 테스트 요건](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Google Play Console 시작하기](https://support.google.com/googleplay/android-developer/answer/6112435)
