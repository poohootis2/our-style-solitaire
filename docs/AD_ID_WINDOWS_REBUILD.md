# Google Play AD_ID 오류: Windows 재빌드 확인

프로젝트 설정에는 `com.google.android.gms.permission.AD_ID`가 포함되어 있습니다. 그러나 Google Play Console은 설정 파일이 아니라 **업로드한 AAB 내부 매니페스트**를 검사합니다. 따라서 기존에 만든 AAB를 다시 업로드하면 이 오류가 계속 나타납니다.

## 1. 현재 Windows 프로젝트의 매니페스트 확인

PowerShell에서 다음을 실행합니다.

```powershell
cd "E:\game_make\our-style-solitaire4\android"
Select-String -Path ".\app\src\main\AndroidManifest.xml" -Pattern "com.google.android.gms.permission.AD_ID"
```

아무 결과가 없으면 `app\src\main\AndroidManifest.xml`의 `<manifest ...>` 바로 아래, 다른 `uses-permission` 줄들과 같은 위치에 다음 한 줄을 추가합니다.

```xml
<uses-permission android:name="com.google.android.gms.permission.AD_ID" />
```

## 2. 새 AAB와 APK 빌드

Google Play에 사용된 버전 코드보다 큰 값을 `android\app\build.gradle`에서 설정한 다음 빌드합니다. 예를 들어 현재 사용된 값이 24라면 25를 사용합니다.

```gradle
versionCode 25
versionName "1.6.9"
```

```powershell
cd "E:\game_make\our-style-solitaire4\android"
.\gradlew.bat clean
.\gradlew.bat bundleRelease
.\gradlew.bat assembleRelease
```

기존 `upload-keystore.jks`와 `signingConfigs.release`는 바꾸지 않습니다.

## 3. 업로드 전 AD_ID 검증

APK는 AAB와 같은 release 매니페스트 구성을 사용하므로 APK에서 권한을 빠르게 확인할 수 있습니다.

```powershell
$aapt = "$env:LOCALAPPDATA\Android\Sdk\build-tools\36.0.0\aapt.exe"
$apk = ".\app\build\outputs\apk\release\app-release.apk"
& $aapt dump permissions $apk | Select-String "com.google.android.gms.permission.AD_ID"
```

명령이 `com.google.android.gms.permission.AD_ID`를 출력하면 새 AAB에도 같은 권한이 들어간 것입니다. `aapt.exe` 경로가 다르면 Android SDK의 `build-tools` 아래 실제 버전 폴더로 바꿉니다.

## 4. Play Console에서 확인할 점

새 `app-release.aab`만 업로드합니다. 오류가 계속되면 Production, 내부 테스트, 비공개 테스트 등에서 활성 상태로 남아 있는 과거 AAB 중 AD_ID가 없는 버전이 있는지 확인합니다. Play Console의 문구처럼 **활성 아티팩트 중 하나**가 권한을 누락한 경우에도 경고가 계속 표시될 수 있습니다.
