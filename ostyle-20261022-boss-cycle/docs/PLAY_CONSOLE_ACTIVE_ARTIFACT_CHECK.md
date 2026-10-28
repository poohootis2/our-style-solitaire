# Play Console 활성 아티팩트 확인 메모

2026-09-02에 Play Console 앱 목록을 읽기 전용으로 확인했습니다.

| 항목 | 확인 결과 |
|---|---|
| 앱 이름 | Monster Solitaire |
| 패키지 이름 | `com.app.ourstylesolitaire` |
| 현재 트랙 상태 | 비공개 테스트 |
| 검토 상태 | 아직 검토를 위해 전송되지 않음 |
| AD_ID 로컬 검증 | 사용자가 Windows release APK에서 `com.google.android.gms.permission.AD_ID` 출력을 확인함 |

앱 목록 화면에서는 개별 트랙의 이전 아티팩트 목록을 바로 열 수 없었습니다. Play Console에서 **테스트 및 출시 > 비공개 테스트 > 현재 트랙**으로 이동해 활성 AAB의 버전 코드를 확인해야 합니다. 새 AAB를 업로드할 때는 기존 활성 버전 코드보다 큰 값을 사용합니다.
