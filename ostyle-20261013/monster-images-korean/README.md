# 몬스터 이미지 한글 분류표

이 압축파일은 현재 프로젝트의 `lib/battle-content.ts` 기준으로 분류했습니다.

## 정식 보스 판정

- 스테이지 4: 산호 골렘 왕
- 스테이지 7: 오징어 대마법사
- 스테이지 11: 대양의 옴니 황제

> 주의: 해파리 여왕 이미지는 챕터 2 보스 목록에 정의되어 있지만, 현재 `isChapterBossStage()`의 정식 보스 판정은 4·7·11단계입니다. 따라서 코드의 보스 플래그와 이미지 목록 사이에 불일치가 있습니다.

## 분류 세부사항

| 구분 | 한글 파일명 | 원본 파일명 | 현재 코드상 용도 |
|---|---|---|---|
| 일반 몬스터 | `01_심해_아귀.png` | `enemy_anglerfish.png` | 챕터 1 / 일반 |
| 일반 몬스터 | `02_푸른_상어.png` | `enemy_blue_shark.png` | 챕터 1 / 일반 |
| 일반 몬스터 | `03_왕복어.png` | `enemy_pufferfish.png` | 챕터 1 / 일반 |
| 일반 몬스터 | `04_해파리_마도사.png` | `tower_jellyfish_mage.png` | 챕터 2 / 일반 |
| 일반 몬스터 | `05_소라_대포병.png` | `tower_hermit_crab_cannon.png` | 챕터 2 / 일반 |
| 일반 몬스터 | `06_산호_골렘.png` | `tower_coral_golem.png` | 챕터 2 / 일반 |
| 일반 몬스터 | `07_해마_주문술사.png` | `tower_seahorse_caster.png` | 챕터 3 / 일반 |
| 일반 몬스터 | `08_오징어_마법사.png` | `tower_squid_mage.png` | 챕터 3 / 일반 |
| 일반 몬스터 | `09_고대_상어.png` | `boss_ancient_shark.png` | 챕터 3 / 일반 목록에 사용됨; 파일명은 보스 계열이지만 현재 코드상 일반 몬스터 |
| 일반 몬스터 | `10_마그마_거북.png` | `boss_magma_turtle.png` | 챕터 4 / 일반 목록에 사용됨 |
| 일반 몬스터 | `11_해마_황제.png` | `boss_seahorse_emperor.png` | 챕터 4 / 일반 목록에 사용됨 |
| 일반 몬스터 | `12_왕실_복어.png` | `boss_royal_pufferfish.png` | 챕터 4 / 일반 목록에 사용됨 |
| 일반 몬스터 | `13_심연_아귀.png` | `boss_abyssal_anglerfish.png` | 챕터 4 / 일반 목록에 사용됨 |
| 일반 몬스터 | `14_융합_산호_여왕.png` | `fusion_trinity_magma_coral_queen.png` | 챕터 4 / 일반 목록에 사용됨 |
| 일반 몬스터 | `15_융합_비전_포병.png` | `fusion_trinity_arcane_artillery.png` | 챕터 4 / 일반 목록에 사용됨 |
| 일반 몬스터 | `16_융합_심연_포식자.png` | `fusion_trinity_abyssal_royal_predator.png` | 챕터 4 / 일반 목록에 사용됨 |
| 보스 몬스터 | `보스_01_산호_골렘_왕.png` | `boss_coral_golem_king.png` | 스테이지 4 |
| 보스 몬스터 | `보스_02_해파리_여왕.png` | `boss_jellyfish_queen.png` | 스테이지 7 |
| 보스 몬스터 | `보스_03_오징어_대마법사.png` | `boss_squid_archmage.png` | 스테이지 7 챕터 보스 |
| 보스 몬스터 | `보스_04_대양의_옴니_황제.png` | `final_boss_oceanic_omni_emperor.png` | 스테이지 11 |
| 미사용 보스 이미지 | `미사용_보스_소라_대포_지휘관.png` | `boss_hermit_cannon_commander.png` | 현재 battle-content.ts에서 사용되지 않음 |
