# Windows 최신 소스 반영 및 Google Play 서명키 보존 안내

## 중요한 확인 사항

현재 Manus에서 받은 프로젝트 소스에는 다음 파일이 포함되어 있지 않습니다.

- `upload-keystore-brandnew.jks`
- `keystore.properties`
- `android/gradle.properties`
- `android/app/build.gradle`

따라서 기존 PC 프로젝트의 서명키와 비밀번호 설정을 **그대로 보존**하려면, 최신 ZIP을 기존 프로젝트에 통째로 덮어쓰지 말고 소스 폴더만 반영해야 합니다.

> Google Play 업로드 키는 새로 생성하거나 교체하지 마세요. 기존 키의 파일명, alias, store password, key password를 그대로 유지해야 합니다.

## 권장 Windows 경로

기존 프로젝트:

```text
F:\game_make\our-style-solitaire4
```

기존 키스토어 예시:

```text
F:\game_make\our-style-solitaire4\upload-keystore-brandnew.jks
```

키스토어가 `android\app` 또는 프로젝트 루트 중 어디에 있든, 현재 `keystore.properties`와 Gradle 설정이 참조하는 위치를 변경하지 마세요.

## 안전한 반영 순서

1. 기존 프로젝트 전체를 먼저 백업합니다.
2. 최신 ZIP을 임시 폴더에 압축 해제합니다.
3. 기존 프로젝트에서 아래 파일을 별도 백업합니다.
   - `upload-keystore-brandnew.jks`
   - `keystore.properties`
   - `android\gradle.properties`
   - `android\app\build.gradle`
   - `android\build.gradle`
4. 최신 ZIP의 `app`, `lib`, `components`, `assets`, `hooks`, `constants`, `scripts`, `tests`와 루트의 TypeScript/설정 파일만 기존 프로젝트에 반영합니다.
5. `android` 폴더와 서명 관련 파일은 최신 ZIP으로 덮어쓰지 않습니다.
6. 반영 후 백업한 키 파일과 Gradle 설정이 원래 위치에 그대로 있는지 확인합니다.

## PowerShell 예시

ZIP을 다음 임시 폴더에 풀었다고 가정합니다.

```text
F:\game_make\our-style-solitaire4_latest\our-style-solitaire
```

PowerShell에서 다음처럼 실행합니다.

```powershell
$src = "F:\game_make\our-style-solitaire4_latest\our-style-solitaire"
$dst = "F:\game_make\our-style-solitaire4"

robocopy "$src\app" "$dst\app" /E
robocopy "$src\lib" "$dst\lib" /E
robocopy "$src\components" "$dst\components" /E
robocopy "$src\assets" "$dst\assets" /E
robocopy "$src\hooks" "$dst\hooks" /E
robocopy "$src\constants" "$dst\constants" /E
robocopy "$src\scripts" "$dst\scripts" /E
robocopy "$src\tests" "$dst\tests" /E

Copy-Item "$src\package.json" "$dst\package.json" -Force
Copy-Item "$src\pnpm-lock.yaml" "$dst\pnpm-lock.yaml" -Force
Copy-Item "$src\app.config.ts" "$dst\app.config.ts" -Force
Copy-Item "$src\babel.config.js" "$dst\babel.config.js" -Force
Copy-Item "$src\metro.config.js" "$dst\metro.config.js" -Force
Copy-Item "$src\tsconfig.json" "$dst\tsconfig.json" -Force
```

위 명령은 `android` 폴더를 건드리지 않으므로 기존 서명 설정을 보호합니다.

## 서명 설정 확인

```powershell
cd "F:\game_make\our-style-solitaire4"

Get-ChildItem -Recurse -Include *.jks,*.keystore,keystore.properties,gradle.properties |
  Select-Object FullName
```

`upload-keystore-brandnew.jks`가 반드시 기존 위치에 있어야 합니다. 비밀번호는 명령어, GitHub, ZIP에 기록하지 마세요.

키 지문 확인은 기존 비밀번호를 사용해 실행합니다.

```powershell
keytool -list -v `
  -keystore "F:\game_make\our-style-solitaire4\upload-keystore-brandnew.jks" `
  -alias upload
```

Google Play Console에 등록된 업로드 인증서 SHA-1과 출력된 SHA-1이 같아야 합니다. 다르면 빌드하지 말고 기존 키 파일과 alias를 먼저 확인하세요.

## 캐시 정리 및 빌드

소스를 반영한 뒤에만 Android 빌드 캐시를 정리합니다. `android` 폴더 자체와 키 파일은 삭제하지 않습니다.

```powershell
cd "F:\game_make\our-style-solitaire"

Remove-Item -Recurse -Force .\android\app\build -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .\android\.gradle -ErrorAction SilentlyContinue

pnpm install
cd android
.\gradlew.bat clean
.\gradlew.bat :app:assembleRelease
.\gradlew.bat :app:bundleRelease
```

빌드 산출물:

```text
android\app\build\outputs\apk\release\app-release.apk
android\app\build\outputs\bundle\release\app-release.aab
```

## 최종 주의사항

- `upload-keystore-brandnew.jks`를 새로 생성하지 않습니다.
- `keystore.properties`의 비밀번호를 수정하지 않습니다.
- 최신 ZIP을 기존 프로젝트 루트에 통째로 덮어쓰지 않습니다.
- `android` 폴더는 기존 PC 프로젝트의 것을 유지합니다.
- 키스토어와 비밀번호는 GitHub나 다른 ZIP에 업로드하지 않습니다.
- APK/AAB 빌드 전 SHA-1을 Google Play Console의 기존 업로드 인증서와 대조합니다.
