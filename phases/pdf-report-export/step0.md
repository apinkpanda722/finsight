# Step 0: report-pdf-builder

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/docs/ADR.md` — ADR-012 전체(Pro 전용 PDF 리포트 결정 + 맨 마지막 "한글 폰트 임베딩(추가 결정)" addendum). 이 addendum은 실제로 pdf-lib+fontkit 조합에서 가변 폰트(Noto Sans KR) 임베딩 시 한글 글리프가 깨지는 문제를 직접 재현/검증하고 내린 결정이다 — 반드시 그대로 따를 것(가변 폰트로 바꾸거나 `subset: true`로 "최적화"하지 마라, 이미 실패가 확인된 조합이다).
- `/docs/ARCHITECTURE.md` — 디렉토리 레이어 규칙(`src/services/`=도메인 로직, `src/components/`=UI, `src/lib/`=외부 API 래퍼)
- `src/services/dashboardInsightService.ts` — `CategorySummary`/`MonthSummary` 타입(6~14행), `summarizeByCategory`/`summarizeByMonth`(26~62행), `getMonthKey(date?, timeZone?)`(63행~). 이번 step은 이 파일을 수정하지 않고 타입만 재사용한다.
- `src/components/dashboard/dashboard-insights.tsx` — `CATEGORY_LABELS`(23~39행, 카테고리 코드→한글 라벨 매핑)와 `formatWon`(48행, `${value.toLocaleString("ko-KR")}원` 포맷)의 현재 위치. 이번 step에서 `CATEGORY_LABELS`를 이 파일 밖으로 옮긴다(아래 "작업" 참고).
- `src/types/domain.ts` — `TRANSACTION_CATEGORIES`(10~26행) 옆에 카테고리 관련 상수가 모여 있는 현재 구조.
- `src/lib/pdf/parse.ts` — 기존 pdfjs-dist 사용 예시. **주의**: 이 파일은 은행/카드 명세서의 "표를 읽는" 파서이고, 이번 step은 리포트를 "그리는" 반대 방향 작업이다. 이 파일의 함수(`parsePdf`, `isPdfBuffer`)를 가져다 쓰지 말고, 테스트에서 검증용으로 `pdfjs-dist/legacy/build/pdf.mjs`의 `getDocument`/`getTextContent`만 직접 사용한다.
- `src/test/pdf-fixture.ts` — 테스트에서 pdf-lib로 PDF를 만드는 기존 예시(영문 Helvetica만 사용). 이번 step에서 만드는 리포트 빌더와는 별개 파일이니 건드리지 마라.
- `package.json` — `pdf-lib`/`@pdf-lib/fontkit`이 현재 `devDependencies`에 있다.
- `src/assets/fonts/NanumGothic-Regular.ttf`, `NanumGothic-Bold.ttf`, `OFL.txt` — 이미 준비되어 있다(정적 TTF, Google Fonts `google/fonts` 저장소, SIL OFL 라이선스). 파일 내용은 건드리지 마라.

## 작업

1. **`package.json`**: `pdf-lib`와 `@pdf-lib/fontkit`을 `devDependencies`에서 `dependencies`로 옮긴다(둘 다 이후 step에서 만들 API route에서 런타임에 필요하다 — `@pdf-lib/fontkit`도 `doc.registerFontkit(fontkit)`로 런타임에 호출되므로 함께 승격해야 한다. ADR-012 본문은 `pdf-lib`만 언급하지만 fontkit 누락은 런타임 에러로 이어진다).
2. **`CATEGORY_LABELS` 이동**: `src/components/dashboard/dashboard-insights.tsx`의 `CATEGORY_LABELS` 상수(23~39행)를 `src/types/domain.ts`로 옮기고 `export`한다(`TRANSACTION_CATEGORIES` 옆에 두는 것을 권장). `dashboard-insights.tsx`에서는 `@/types/domain`에서 import해서 그대로 쓰도록 import문만 수정한다(사용부 로직은 바꾸지 않는다). 이유: 서비스 레이어(`src/services/`)가 카테고리 한글 라벨이 필요한데, `src/components/`를 import하는 것은 레이어 역전이다.
3. **`src/services/reportPdfService.ts`** 신규 생성:
   ```ts
   export type ReportSummaryInput = {
     categories: CategorySummary[] // dashboardInsightService에서 import
     monthly: MonthSummary[]
     currentMonth: string // "YYYY-MM", getMonthKey() 결과
     generatedAt: Date
   }

   export async function buildCategoryReportPdf(
     input: ReportSummaryInput
   ): Promise<Buffer>
   ```
   구현 세부사항(내부 재량이되 아래 규칙은 반드시 지킬 것):
   - `fs.readFileSync(path.join(process.cwd(), "src/assets/fonts/NanumGothic-Regular.ttf"))`(Bold도 동일 패턴)로 폰트 바이트를 읽는다. `process.cwd()` 기준 상대경로를 써야 나중에 API route(Vercel Function)에서도 동일하게 동작한다 — `import.meta.url` 기반 경로나 `__dirname`을 쓰지 마라.
   - `PDFDocument.create()` → `doc.registerFontkit(fontkit)` → `doc.embedFont(bytes, { subset: false })`. **`subset: false`는 필수다** — ADR-012 addendum 참고, `subset: true`는 이미 한글 글리프 깨짐이 확인된 조합이다.
   - 카테고리 코드 → 한글 라벨은 `CATEGORY_LABELS`(step에서 옮긴 `@/types/domain`)로 조회하고, 매핑에 없는 코드는 원본 코드 문자열을 그대로 표시한다(throw하지 않는다 — 리포트 생성이 알 수 없는 카테고리 하나 때문에 실패하면 안 된다).
   - 금액 포맷은 `dashboard-insights.tsx`의 `formatWon`과 동일한 규칙(`${value.toLocaleString("ko-KR")}원`)으로 이 파일 안에 직접 구현한다(import하지 말 것 — `formatWon`은 export되어 있지 않고, 컴포넌트 파일 import는 레이어 역전이다).
   - 레이아웃은 단순하게: 제목("Finsight 지출 리포트"), 생성일, 카테고리별 지출 표(라벨+금액, `summarizeByCategory` 정렬 순서 그대로), 월별 추이 표(월+금액). 시각적으로 정교할 필요 없다(ADR-012 트레이드오프에 이미 명시됨).
   - `categories`/`monthly`가 빈 배열이어도 에러 없이 "데이터 없음" 같은 안내 텍스트를 그려 PDF를 반환한다(throw하지 않는다).

## Acceptance Criteria

```bash
npm run build
npm test
```

추가로, 아래 스크립트를 임시로 실행해(또는 테스트 안에서) 실제로 한글이 깨지지 않고 임베딩되는지 눈으로도 확인한다 — Buffer를 파일로 저장해 PDF 뷰어로 직접 열어봐도 되고, 테스트의 pdfjs-dist 추출 결과를 콘솔에 출력해봐도 된다.

## 검증 절차

1. `npm run build && npm test`가 통과해야 한다. 이 step은 새 파일 추가 + `CATEGORY_LABELS` 이동뿐이라 기존 빌드/테스트를 깨뜨리면 안 된다(remove-accounts phase와 달리 이번 phase는 매 step이 그린 빌드를 유지하는 것이 정상이다).
2. `src/services/reportPdfService.test.ts`를 작성해 아래를 검증한다:
   - `buildCategoryReportPdf`에 한글 카테고리가 섞인 `categories`(예: `food_dining`, `transport`)와 `monthly` 데이터를 넣어 생성한 PDF를, `pdfjs-dist/legacy/build/pdf.mjs`의 `getDocument`/`getTextContent`로 다시 읽어 텍스트를 추출한다.
   - 추출된 텍스트에 "식비", "교통" 같은 `CATEGORY_LABELS`의 한글 라벨이 깨지지 않고(예: `�`나 빈 문자열이 아니라) 정확히 포함되는지 assert한다. **이게 이 step의 핵심 회귀 테스트다** — ADR-012 addendum이 실제로 해결한 문제를 재현·고정하는 테스트이므로 대충 넘기지 마라.
   - 금액이 `toLocaleString("ko-KR")` 포맷(천단위 콤마 + "원")으로 나오는지 확인한다.
   - `categories: []`, `monthly: []` 빈 입력에도 예외 없이 Buffer가 반환되는지 확인한다.
3. `CATEGORY_LABELS` 이동 후 `dashboard-insights.test.tsx`가 여전히 통과하는지 확인한다(기존 테스트가 카테고리 라벨 렌더링을 검증하고 있다면 값이 그대로 나와야 한다).
4. 아키텍처 체크리스트:
   - `src/services/reportPdfService.ts`가 `src/components/**`를 import하지 않는가?
   - CLAUDE.md CRITICAL 규칙 위반 없는가? (이 step은 Supabase/Anthropic을 호출하지 않으므로 deps injection 규칙 대상이 아니다 — 순수 PDF 렌더링 함수다)
5. 결과에 따라 `phases/pdf-report-export/index.json`의 step 0을 업데이트한다:
   - 통과 → `"status": "completed"`, summary에 `buildCategoryReportPdf` 시그니처와 `CATEGORY_LABELS` 이동 위치를 남긴다.
   - 3회 시도 후 실패 → `"status": "error"`

## 금지사항

- `src/lib/pdf/parse.ts`(명세서 "읽기" 파서)를 이 "쓰기" 기능에 재사용하거나 이 파일을 리팩터링하지 마라 — 무관하다.
- API route나 UI 컴포넌트를 만들지 마라 — step 1/2 범위다.
- `CATEGORY_LABELS` 이동 외에 `dashboard-insights.tsx`의 다른 부분(포맷 함수, JSX, 스타일)을 건드리지 마라.
- `src/assets/fonts/` 안의 폰트 파일이나 `OFL.txt` 내용을 수정하지 마라.
- `subset: true`나 가변 폰트로 "더 작은 PDF"를 시도하지 마라 — ADR-012 addendum에 이미 실패가 기록된 접근이다.
