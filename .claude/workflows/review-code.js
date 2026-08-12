export const meta = {
  name: 'review-code',
  description: '차원별 병렬 서브에이전트로 변경분을 리뷰하고 각 발견을 adversarial 검증',
  phases: [
    { title: 'Review', detail: '차원별(correctness·security·architecture) 병렬 리뷰' },
    { title: 'Verify', detail: '각 발견을 3명 skeptic이 반박, 2/3 다수결로 false positive 제거' },
  ],
}

// ── 입력 ─────────────────────────────────────────────────────────────────────
// args = { diff: string, files: string, repoDocs: string, scope?: string }
//   diff:     통합 diff 텍스트 (변경 라인 번호 포함)
//   files:    변경 파일 목록(개행 구분)
//   repoDocs: CLAUDE.md + ARCHITECTURE.md + ADR.md 본문(가드레일)
//   scope:    리뷰 범위 설명 (예: "main...HEAD") — 표시용
let input = args
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch {
    input = {}
  }
}
const diff = input?.diff ?? ''
const files = input?.files ?? ''
const repoDocs = input?.repoDocs ?? ''

log(`[review-code] args=${typeof args} diffLen=${diff.length} filesLen=${files.length} docsLen=${repoDocs.length}`)

if (!diff.trim()) {
  log('[review-code] diff가 비어 종료 (입력 전달 확인 필요)')
  return { confirmed: [], stats: { total: { raw: 0, confirmed: 0, agents: 0 }, byDim: {}, bySeverity: {} } }
}

// ── 스키마 ───────────────────────────────────────────────────────────────────
const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'line', 'title', 'tldr', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'nit'] },
          file: { type: 'string', description: '저장소 루트 기준 경로 (예: src/services/statements.ts)' },
          line: { type: 'number', description: 'diff 신규(RIGHT) 측 라인 번호 — 인라인 코멘트 게시용' },
          title: { type: 'string', description: '한 줄 제목' },
          tldr: { type: 'string', description: '무엇이/왜 문제인가 한 줄' },
          good: { type: 'string', description: '잘 지킨 맥락/규칙 (없으면 빈 문자열)' },
          fix: { type: 'string', description: '수정 방안 — 가능하면 코드 스니펫' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'reason'],
  properties: {
    isReal: { type: 'boolean', description: '진짜 문제이며 보고할 가치가 있으면 true' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string', description: '판단 근거 한 줄' },
  },
}

// ── 차원 정의 (MVP 3개) ──────────────────────────────────────────────────────
// 향후 확장(behavioral-correctness, performance, cpu-perf-patterns, privacy,
// conventions, test-coverage, cross-file-consistency): 이 배열에 { key, prompt } 항목을 추가하기만 하면 된다.
const common = (dimensionName) =>
  `너는 finsight 코드 리뷰어다. 아래 diff에서 **${dimensionName}** 차원만 검토한다.\n` +
  `\n규칙:\n` +
  `- 이 차원에 해당하는 위반·버그만 보고하라. 다른 차원·스타일 취향·범위 밖 개선은 무시하라.\n` +
  `- 추측성 지적 금지. diff와 가드레일 문서로 확인 가능한 것만 보고하라.\n` +
  `- 발견이 없으면 findings를 빈 배열로 반환하라. 억지로 만들지 마라.\n` +
  `- 각 발견의 file은 저장소 루트 기준 경로, line은 diff 신규(RIGHT) 측 라인 번호로 적어라(인라인 코멘트 게시에 쓰인다).\n` +
  `- good은 해당 위치에서 잘 지킨 규칙/맥락(없으면 빈 문자열), fix는 수정 방안(가능하면 코드).\n` +
  `\nseverity 기준:\n` +
  `- critical: 보안 취약점 · 데이터 무결성 훼손 · 명백한 런타임/로직 버그(머지 차단 수준)\n` +
  `- major: CRITICAL 규칙 위반 · 잘못된 동작(머지 전 수정 필요)\n` +
  `- minor: 개선 권장(머지는 가능)\n` +
  `- nit: 취향/사소\n`

const DIMENSIONS = [
  {
    key: 'correctness',
    prompt:
      common('correctness (로직 정확성)') +
      '\n이 차원의 집중 검사 항목(finsight CRITICAL 규칙):\n' +
      "- 날짜/금액/부호 변환이 결정론적 코드로 수행되는가. Claude 응답값(카테고리 분류 등)을 날짜/금액처럼 정확해야 하는 값 대신 사용하지 않는가.\n" +
      "- 카테고리 분류 100행 batch마다 rowIndex 완전성을 검증하고, 최종적으로 전체 건수와 source debit/credit 합계를 reconciliation하는가 — 누락되면 거래가 조용히 사라질 수 있다.\n" +
      "- CSV 업로드 시 인코딩(UTF-8/CP949)·구조(RFC 4180)·행 수(≤2,000) 검증이 올바른가.\n" +
      "- Polar webhook에서 modified_at이 profiles.polar_modified_at보다 새로울 때만 UPDATE하는가 — 역순/stale 이벤트가 최신 권한을 되돌리면 안 된다.\n" +
      "- processing lease(CAS)·row_index unique 제약 기반 재시도가 중복 거래를 만들지 않는가.\n" +
      "- transient(429/5xx/네트워크) vs permanent(refusal/스키마·reconciliation 실패) 에러 분기가 올바른가(전자만 재시도).\n" +
      "- 그 외 일반 로직 버그(off-by-one, null/undefined 처리 누락, 잘못된 조건문·비교 연산자, await 누락, race condition).\n" +
      '\n판단 근거는 diff와 그 주변 코드 자체로 한정하라. "요구사항과 다르게 동작한다"류의 스펙 대조가 필요한 판단은 이 차원이 아니다.',
  },
  {
    key: 'security',
    prompt:
      common('security (보안)') +
      '\n이 차원의 집중 검사 항목(finsight CRITICAL 규칙):\n' +
      "- 라우트 보호/세션 확인에 getClaims() 또는 getUser()만 쓰는가. getSession()은 로컬 JWT만 검증하고 서버 측 무효화를 확인하지 않으므로 금지.\n" +
      "- profiles.plan과 구독 스냅샷 필드(subscription_status, polar_subscription_id, current_period_end, cancel_at_period_end, polar_modified_at)를 검증된 Polar webhook 코드(service_role) 밖에서 갱신하지 않는가.\n" +
      "- Supabase Storage 경로에 사용자가 업로드한 원본 file_name을 쓰지 않는가 — {user_id}/{statement_id} 서버 생성 식별자만 사용해야 한다.\n" +
      "- transaction description/file_name/error_message를 dangerouslySetInnerHTML이나 원시 HTML로 렌더링하지 않는가 — JSX 텍스트 노드로만.\n" +
      "- Polar checkout/portal 라우트가 인증된 same-origin POST만 허용하고, product ID·customer ID를 body/query에서 받지 않고 서버가 세션 사용자 + POLAR_PRO_PRODUCT_ID로 고정하는가.\n" +
      "- complete-upload에서 클라이언트가 보낸 크기/인코딩/구조 값을 그대로 신뢰하지 않고 서버가 Storage 원본을 재검증하는가.\n" +
      "- webhook이 서명 검증 + product/external_id 검증을 거치는가.\n" +
      "- 그 외 일반 보안 이슈: injection, secret 하드코딩/노출, CSRF, IDOR(다른 사용자 리소스 접근 가능 경로).\n" +
      '\n민감정보 로깅 자체(CSV 원문·PII를 로그에 남기는 문제)는 이 차원이 아니다 — 공격 표면(누가 무엇을 악용할 수 있는가)에 집중하라.',
  },
  {
    key: 'architecture',
    prompt:
      common('architecture (구조 규칙)') +
      '\n이 차원의 집중 검사 항목(finsight CRITICAL 규칙):\n' +
      "- 서비스 함수(src/services/*.ts)가 Supabase/Anthropic 클라이언트를 deps: { supabase, anthropic }로 주입받는가 — 내부에서 직접 createServerClient()나 new Anthropic()을 호출하면 위반.\n" +
      "- API route handler(src/app/api/**/route.ts)가 얇게 유지되고 실제 로직을 서비스 함수로 위임하는가.\n" +
      "- accounts/uploaded_statements/transactions에 대한 쓰기가 반드시 create_statement_upload/finalize_statement RPC를 통하는가 — route handler가 이 테이블에 직접 INSERT/UPDATE하면 위반(quota 검사·composite 소유권 검증·재처리 멱등성이 RPC 트랜잭션 밖에서 깨진다).\n" +
      "- Free 사용자의 과거(최근 3개월 이전) 거래 존재 여부를 UI에 보여줄 때 has_locked_history() RPC만 쓰는가 — 실제 거래를 조회해 존재 여부를 판단하면 위반.\n" +
      "- 사용자 소유 리소스 참조 테이블 간에 (user_id, id) unique + composite FK 패턴이 유지되는가.\n" +
      "- Claude 호출 경계를 지키는가 — 컬럼 매핑은 헤더+샘플 최대 20행만, 카테고리 분류는 100행 단위 batch로만. CSV 전체를 한 번에 넘기면 위반.\n" +
      "- 컴포넌트는 src/components/, 타입은 src/types/, 외부 API 래퍼는 src/lib/, 도메인 로직은 src/services/로 분리되는가.\n" +
      '\n네이밍·포맷팅·import 순서 같은 스타일 이슈는 이 차원이 아니다 — 레이어 경계와 지정된 진입점 강제에만 집중하라.',
  },
]

// ── 검증 폭발 방지 ───────────────────────────────────────────────────────────
const MAX_PER_DIM = 8 // 차원당 검증 대상 finding 상한. 초과분은 log로 고지(silent cap 금지).

// ── Review → Verify 파이프라인 ───────────────────────────────────────────────
// pipeline: 한 차원의 발견이 검증되는 동안 다른 차원은 아직 리뷰 중이어도 됨(barrier 불필요).
const results = await pipeline(
  DIMENSIONS,
  // 1단계: 차원별 리뷰
  (d) =>
    agent(
      `${d.prompt}\n\n## 가드레일 문서\n${repoDocs}\n\n## 변경 파일\n${files}\n\n## diff\n${diff}`,
      { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA },
    ),
  // 2단계: 각 발견을 3명 skeptic이 반박 → 2/3 다수결
  (review, dim) => {
    const found = (review?.findings ?? []).map((f) => ({ ...f, dimension: dim.key }))
    if (found.length > MAX_PER_DIM) {
      log(`${dim.key}: 발견 ${found.length}건 중 상위 ${MAX_PER_DIM}건만 검증(상한). 나머지는 미검증으로 제외.`)
    }
    return parallel(
      found.slice(0, MAX_PER_DIM).map((f) => () =>
        parallel(
          Array.from({ length: 3 }, (_, i) => () =>
            agent(
              `다음 리뷰 발견이 진짜 문제인지 반박하라. 의심부터 하고, 확신이 없으면 isReal=false를 기본값으로 삼아라.\n\n` +
                `[${f.severity}] ${f.title}\n위치: ${f.file}:${f.line}\nTL;DR: ${f.tldr}\n제안된 수정: ${f.fix}\n\n` +
                `아래 diff와 가드레일로 교차검증하라. 발견이 실제 변경된 코드에 근거하는지, 오해/허위(예: 존재하지 않는 라인, 이미 처리된 케이스)는 아닌지 확인하라.\n\n` +
                `## 가드레일 문서\n${repoDocs}\n\n## diff\n${diff}`,
              { label: `verify:${dim.key}:${i}`, phase: 'Verify', schema: VERDICT_SCHEMA },
            ),
          ),
        ).then((votes) => {
          const yes = votes.filter(Boolean).filter((v) => v.isReal).length
          return { ...f, real: yes >= 2, votes: yes }
        }),
      ),
    )
  },
)

// ── 집계 ─────────────────────────────────────────────────────────────────────
const all = results.flat().filter(Boolean)
const confirmed = all.filter((f) => f.real)

const byDim = {}
for (const f of all) {
  byDim[f.dimension] = byDim[f.dimension] ?? { raw: 0, confirmed: 0 }
  byDim[f.dimension].raw++
  if (f.real) byDim[f.dimension].confirmed++
}

const bySeverity = { critical: 0, major: 0, minor: 0, nit: 0 }
for (const f of confirmed) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1

// 실제 소환된 에이전트 총수: 차원별 리뷰 1개 + 검증 대상 finding마다 skeptic 3명.
const totalAgents = DIMENSIONS.length + all.length * 3

log(
  `검증 완료: 후보 ${all.length}건 → 확정 ${confirmed.length}건 ` +
    `(critical ${bySeverity.critical} · major ${bySeverity.major} · minor ${bySeverity.minor} · nit ${bySeverity.nit}) ` +
    `— 에이전트 ${totalAgents}개 사용`,
)

return {
  confirmed,
  stats: { total: { raw: all.length, confirmed: confirmed.length, agents: totalAgents }, byDim, bySeverity },
}
