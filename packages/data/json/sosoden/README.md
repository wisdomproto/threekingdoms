# 조조전 시스템 데이터 셋 (sosoden/)

> 코에이 《삼국지 조조전》(1998) 원본에서 추출한 **v1 전투 시스템 원천** 데이터.
> CLAUDE.md §2-9(2026-06-13 확정): **맵=영걸전 / 시스템=조조전**. 병종·능력치·책략·아이템·전투공식·일기토는 이 셋을 원천으로 런타임 데이터(packages/data/json/)에 반영한다. 맵/지형은 영걸전 유지.
> ✅ 런타임 1차 이식: `commanders.json` 118명을 조조전 능력치(×2 스케일)로 반영(`tools/hero-extract/port_commanders.py`). 병종/무기/책략 반영은 조조전 데미지 공식 확보 후 (아래 "다음 단계").

추출 경위·포맷 분석: [docs/reference/sosoden-source-analysis.md](../../../../docs/reference/sosoden-source-analysis.md)
재생성: `tools/hero-extract/extract_sosoden_data.py`, `eex_extract.py`

---

## ⚠️ IP / 커밋 주의

- **수치 테이블**(스탯·power·MP 등)은 사실 데이터(저작권 비보호) — 영걸전 셋과 동일 취급.
- **scripts/ 의 대사 텍스트는 코에이의 저작 대사 원문** — 내부 분석/레퍼런스 한정. 게임에 원문 그대로 싣지 않는다. 저장소 커밋 여부는 길중 판단 필요.

---

## 파일

### `generals.json` — 장수 512명 (DATA.E5 chunk 0, 32B/레코드)
능력치 순서는 원형 장수 삼각측량(허저 무력49·지력18 / 곽가 무력11·지력49)으로 **확정** — 팬에디터 MAIN.TXT 필드순("무력 통솔력 지력 민첩성 운")과 일치.
| 필드 | 의미 | 신뢰도 |
|---|---|---|
| `name` | 장수명 (CP949) | ✅ |
| `classId` / `className` | 병종 번호 (JOB.TXT 일치 — 조조=군주계, 관우=기병계) | ✅ 검증 |
| `graphicId` | 얼굴/그래픽 id | ✅ |
| `mar` / `ldr` / `int` / `agi` / `luck` | 무력 / 통솔력 / 지력 / 민첩성 / 운 | ✅ 검증 |
| `hp` | HP (무관 120 / 문관 80) | ✅ |
| `mp` | MP (문관 ↑ / 무관 ↓) | ✅ |
| `val29` | 진영/플래그 | ⚠️ 추정 |
| `_raw` | 32바이트 hex (재해석용) | — |

### `classes.json` — 병종 53종 (DATA.E5 chunk 3, 27B/레코드)
JOB.TXT 병종표와 1:1. **조조전엔 영걸전식 병종별 baseAtk/baseDef가 없음** — 공격력은 무력+무기+병종상성에서 파생.
| 필드 | 의미 | 신뢰도 |
|---|---|---|
| `classId` / `name` | 병종 번호/이름 | ✅ |
| `move` | 이동력 (기병6/보병4/포차3, 승급3단 +1) | ✅ 검증 |
| `casterType` | 1 일반 / 2 책사계 / 3 주술·선인 | ✅ 검증 |
| `categoryBit` | c09~26 원핫 = 스프라이트/병종 카테고리 그룹 | ✅ 구조 |
| `terrain_c2_6` | 지형 적성 5값 (추정) | ⚠️ |
| `flag1` / `c7` | 특수 플래그 / 기본 계수 (추정) | ⚠️ |
| `_raw` | 27바이트 hex | — |

### `weapons.json` — 무기/아이템 104종 (DATA.E5 chunk 1, 25B/레코드)
| 필드 | 의미 | 신뢰도 |
|---|---|---|
| `name` | 아이템명 | ✅ |
| `power` | 위력 (단검5<대검10<강검30 순서로 검증) | ✅ 검증 |
| `markerAt` / `preMarker` / `fields` | 0xff 마커 위치 + 전/후 바이트 | ⚠️ 구조 |
| `_raw` | 25바이트 hex | — |

### `strategies.json` — 책략 73종 (DATA.E5 chunk 5, 70B/레코드)
| 필드 | 의미 | 신뢰도 |
|---|---|---|
| `name` | 책략명 | ✅ |
| `category` / `categoryName` | 책략 종류 28종 (0~3=화·수·지·풍 공격, 4+=현혹·유혹·둔병·보급·사신·날씨 등) | ✅ 검증 |
| `mp` | MP 소모 | ✅ 검증 |
| `power` | 위력 (초열6<업화10<화진12<화룡20<폭염24) | ✅ 검증 |
| `rangeShapeRef` | `rangeShapes.json` 셰이프 참조 (추정) | ⚠️ |
| `tierVal` | 레벨/변형 (추정) | ⚠️ |
| `effectMatrix` | 레벨/구역별 데미지 매트릭스 (off 35~63) | ⚠️ 구조 |
| `_raw` | 70바이트 hex | — |

### `rangeShapes.json` — 범위 셰이프 58종 (DATA.E5 chunk 2, 36B/레코드)
책략/무기의 AoE 형태 템플릿. `cells` = 영향 셀 오프셋 리스트 (AoE 클수록 길어짐). `head`=[X,0,Y,0] 의미 추정. 책략 `rangeShapeRef`가 이를 참조.

### `growthProfiles.json` — 성장 프로파일 27종 (DATA.E5 chunk 4, 60B/레코드)
구조 확정(27 × 60B = `[hpGrowth 30] + [statGain 30]`). **27개가 거의 균일** → 조조전 성장은 병종별 차등이 작음(레벨당 HP/병력 ~10 + 소량 스탯업). 영걸전식 병종별 성장표와 다른 점.
| 필드 | 의미 | 신뢰도 |
|---|---|---|
| `profileId` | 프로파일 번호 (병종과 1:1 아님) | ✅ 구조 |
| `hpGrowth` | 레벨별 HP/병력 증가 30값 (~10) | ⚠️ 추정 |
| `statGain` | 레벨별 스탯업 코드 30값 (null=없음) | ⚠️ 추정 |

### `scripts/*.json` — EEX 대사 스크립트 117개 (+ `_index.json`) — ⚠️ gitignore(IP)
대사·내레이션 텍스트 레이어. `lines[]`: `{off, enc(cp949|sjis), text}` (예: R_00 = "乱世の姦雄、治世の能臣").

### `events/*.json` — EEX 이벤트 블록 구조 117개 (+ `_index.json`) — ⚠️ gitignore(IP)
헤더 dword 오프셋 테이블로 분절한 **이벤트 블록 469개**. 각 블록 = `{offset, size, title, lines}`.
- 게임 전체 스토리 이벤트 구조가 드러남 (예: R_16 = "관우 조조에게 투항한다"·"적토마"·"관우의 본심", R_15 = "여포의 최후"·"초선 가입").
- **블록 = `[01 00][ptr][02 00 05 00][제목][00 00 00][명령 워드열]`**. 명령부 opcode(0x30·0x2b·0x0d·0x09…)는 **VM 스펙 없이 미해독** — 정확한 발동조건(턴/위치/격파/일기토)은 후속 디컴파일 필요.
- 재생성: `tools/hero-extract/eex_events.py`.

---

## 다음 단계 (미완)
1. 조조전 **데미지 공식** EXE 리버싱 → 병종 unitClasses 전환(baseAtk/baseDef 없는 모델) + combat.ts 재작성.
2. 밸런스 재보정(§11): 영걸전 튜닝 스테이지가 조조전 스탯과 부정합 — 재밸런싱.
3. 책략 `effectMatrix`·`rangeShapes.head`·growth `statGain` 코드의 정확한 스탯/레벨 매핑 (앵커 부족, 조조전 자료 이미지 대조로 보완 가능).
4. EEX opcode VM 디컴파일 → 이벤트/일기토 트리거를 stage `events[]` 스키마로.
