# Step 4: sample-statement-refresh

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` ADR-011 — 은행/카드명은 파일에서 파싱한 표시용 라벨이라는 결정
- 이전 step들의 산출물(`phases/remove-accounts/index.json`) — 특히 step 1에서 `parsePdf()`가 헤더 행 이전 텍스트를 `preambleLines`로 반환하게 됐고, `inferColumnMapping`이 그 preamble + 파일명을 근거로 `detectedLabel`을 추론한다는 점
- `scripts/generate-sample-statement-pdf.mjs` 전체 — 지금은 74~76행에서 제목 한 줄("2026년 8월 신한카드 이용대금 명세서")만 표 위에 그리고 있다. 이 제목 자체가 이미 "신한카드"라는 은행/카드사명을 담고 있어 `headerLineIndex` 탐색(표 헤더 "거래일자/적요/출금액/입금액"을 찾는 로직) 기준으로 preamble 한 줄로 잡히지만, 사용자는 여기에 계좌/카드번호처럼 더 명확한 식별 정보를 추가로 원한다
- `src/lib/pdf/parse.ts` — step 1에서 추가된 `preambleLines` 반환 로직(header 행 탐색은 `segments.length >= 2`인 첫 줄을 찾는 방식이라, 제목/계좌번호 줄이 실수로 헤더로 오인되지 않으려면 각 줄이 큰 간격(`SEGMENT_GAP_THRESHOLD=12pt`)으로 나뉘는 2개 이상의 세그먼트를 만들지 않아야 한다 — 한 줄에 라벨과 값을 큰 간격 없이 붙여 쓰면 안전하다)

## 작업

1. **기존 `sample-statement.pdf` 삭제**(`git rm sample-statement.pdf` 또는 파일 삭제).
2. **`scripts/generate-sample-statement-pdf.mjs` 수정**: 표 헤더를 그리기 전에, 제목 줄 아래 계좌/카드 식별 정보를 담은 줄을 하나 더 추가한다. 예: `"카드번호 1234-56**-****-7890"` 같은 마스킹된 카드번호 한 줄(x=50, 제목과 표 헤더 사이). 이 줄이 표 헤더로 오인되지 않도록 한 번의 `drawText` 호출로 붙여서 그린다(위 SEGMENT_GAP_THRESHOLD 관련 주의사항 참고).
3. **재생성**: `node scripts/generate-sample-statement-pdf.mjs`를 실행해 새 `sample-statement.pdf`를 프로젝트 루트에 만든다.
4. **수동 검증**: 재생성된 `sample-statement.pdf`를 `Buffer`로 읽어 `parsePdf()`에 통과시켰을 때 `preambleLines`에 제목 줄과 카드번호 줄이 모두 포함되는지 스크래치 스크립트나 Node REPL로 직접 확인한다(이 확인 자체를 자동화 테스트로 만들 필요는 없다 — 이 파일은 실제 한글 폰트가 설치된 OS에서만 생성 가능해서 CI 환경에 따라 폰트를 못 찾을 수 있고, 그런 환경 의존성을 자동 테스트에 넣지 않기 위해서다. 확인에 쓴 스크래치 스크립트는 커밋하지 말고 지운다).

## Acceptance Criteria

```bash
node scripts/generate-sample-statement-pdf.mjs   # 새 sample-statement.pdf 생성, 에러 없이 종료
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 4번 수동 검증(preamble에 카드번호 줄 포함)을 실제로 수행했는지 확인한다.
3. `phases/remove-accounts/index.json`의 step 4를 업데이트한다. 이 phase의 마지막 step이므로, 완료 시 이 step까지 모두 반영됐는지 `git status`로 확인한다.

## 금지사항

- `src/lib/pdf/parse.ts`, `src/services/statementParserService.ts`의 파싱/추론 로직 자체는 이미 step 1에서 끝났다 — 이번 step에서 다시 손대지 마라. 이번 step은 오직 샘플 파일과 그걸 만드는 스크립트만 다룬다.
- 재현성 없는 스크래치 검증 스크립트를 리포지토리에 남기지 마라.
- `TRANSACTIONS` 배열의 실제 거래 내역(카테고리 커버리지, Free 잠금 경계용 날짜 분포)은 기존 의도(15개 카테고리, 최근 3개월 안팎 날짜)를 유지해야 하니 이유 없이 바꾸지 마라 — 계좌번호 줄 추가 외에는 최소 변경.
