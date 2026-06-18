# 에셋 생성 파이프라인 (Gemini → 컷 → public/+R2)

보드(`docs/art/asset-board.html`)가 프롬프트 **SSOT**. 여기서 prompts.json을 뽑아 Gemini로 생성하고,
시트는 자동으로 컷/슬라이스해 `apps/web/public/assets/`(+ R2)에 넣는다. 게임은 `assetUrl()`로 자동 표시.

## 준비
```
pip install google-genai pillow boto3
cp tools/.env.gemini.example .env.gemini   # 루트에. GEMINI_API_KEY 채우기
```

## 사용
```
# 1) 보드 → 프롬프트 카탈로그
node tools/sprite-pipeline/gen/export_prompts.mjs       # prompts.json (씬54·초상15·SD109)

# 2) 생성 (먼저 --dry-run 으로 확인)
python tools/sprite-pipeline/gen/gen_assets.py --only scene --limit 3 --dry-run
python tools/sprite-pipeline/gen/gen_assets.py --only scene             # 씬 전체
python tools/sprite-pipeline/gen/gen_assets.py --only portrait          # 초상 그룹→멤버 슬라이스
python tools/sprite-pipeline/gen/gen_assets.py --id N-05o --force       # 특정/재생성
```

## 비전 QA 루프 (Claude)
생성 후 Claude가 결과 이미지를 Read로 보고, 이상한 것만 `--id <jobId> --force` 로 재생성한다.
프롬프트 자체가 문제면 보드에서 고치고 → export_prompts.mjs 재실행 → 재생성.

## 카테고리별 특성
- **scene** (54): 텍스트→이미지. 자족적 프롬프트(실내/야외 구분 포함). webp 저장.
- **portrait** (15그룹): 텍스트→그리드 시트 → 행우선 멤버 슬라이스 → `{이름}.webp`.
- **sd** (109): **레퍼런스 첨부 img2img**. `gen/refs/{spriteId}.png`(캐릭터 ref 시트)가 있어야 일관됨.
  ref 없으면 텍스트만으로 생성되나 품질·일관성 저하 → ★캐릭터 ref부터 확보 권장. 컷=cut_posesheet.py.

## 산출물
- 중간 시트: `gen/_raw/`, `prompts.json` (gitignored)
- 최종 에셋: `apps/web/public/assets/...` + R2(`.env.r2` 있으면). 스프라이트는 R2가 배포 원천.
