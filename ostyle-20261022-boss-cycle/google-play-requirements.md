# Google Play 게시 요건 조사 메모

확인일: 2026-08-31

## 공식 확인 사항

1. Google Play 타깃 API 요건: 2026년 8월 31일부터 신규 앱과 앱 업데이트는 Android 16(API 36) 이상을 타깃으로 해야 제출할 수 있다. 기존 앱은 신규 사용자 배포 유지에 Android 15(API 35) 이상 요건이 적용된다.
출처: https://support.google.com/googleplay/android-developer/answer/11926878?hl=en

2. Google Play 업로드: 신규 앱은 Play App Signing 등록이 필수이며, 로컬에서 서명된 Android App Bundle(.aab)을 만든 뒤 Play Console에 업로드해야 한다. 앱 번들 누적 다운로드 크기 한도는 4GB이다.
출처: https://developer.android.com/studio/publish/upload-bundle

3. 현재 프로젝트 app.config.ts의 expo-build-properties 설정은 minSdkVersion 24이며, Android targetSdkVersion은 생성된 Expo/Gradle 설정에 의존한다. 2026년 신규 앱 제출을 위해 로컬 빌드 시 target API 36 적용 여부를 확인해야 한다.
