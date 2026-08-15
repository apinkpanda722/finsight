// finsight CLAUDE.md의 CRITICAL 룰 요약 — 경량 리뷰어(eval 대상)의 채점 기준이다.
// 룰 문구는 케이스 frontmatter의 rule과 의미가 일치해야 한다. CLAUDE.md의 CRITICAL 룰이
// 바뀌면 이 목록도 함께 갱신한다 — 갱신을 빠뜨리면 review 케이스가 조용히 낡는다.

export const FINSIGHT_RULES: readonly string[] = [
  "서비스 함수(src/services/*.ts)는 Supabase/Anthropic 클라이언트를 deps로 주입받는다. 내부에서 직접 createServerClient()나 new Anthropic()을 호출하지 않는다.",
  "API route handler(src/app/api/**/route.ts)는 얇게 유지한다. 실제 로직은 서비스 함수로 위임한다.",
  "라우트 보호·세션 확인에 getSession()을 쓰지 않는다. getClaims() 또는 getUser()만 사용한다 — getSession()은 로컬 JWT만 검증하고 서버측 무효화를 확인하지 않는다.",
  "profiles.plan과 구독 스냅샷 필드(subscription_status·polar_subscription_id·current_period_end 등)는 검증된 Polar webhook 코드(service_role)에서만 갱신한다.",
  "accounts/uploaded_statements/transactions에 대한 쓰기는 반드시 create_statement_upload/finalize_statement RPC를 통해서만 한다. route handler가 이 테이블에 직접 INSERT/UPDATE하지 않는다.",
  "Free 사용자의 과거(최근 3개월 이전) 거래 존재 여부는 has_locked_history() RPC만으로 확인한다. 실제 거래를 조회해 존재 여부를 판단하지 않는다.",
  "Supabase Storage 경로에는 사용자가 업로드한 원본 file_name을 절대 쓰지 않는다. {user_id}/{statement_id} 컨벤션의 서버 생성 식별자만 사용한다.",
  "CSV 원문, mapping/category 프롬프트, transaction description 배열, webhook payload 전체를 로그에 그대로 찍지 않는다.",
  "transaction description/file_name/error_message는 신뢰할 수 없는 입력으로 취급한다. dangerouslySetInnerHTML을 쓰지 않고 JSX 텍스트 노드로만 렌더링한다.",
  "Polar checkout/portal 라우트는 인증된 same-origin POST만 허용한다. product ID·customer ID를 body/query에서 받지 않고 서버가 세션 사용자와 POLAR_PRO_PRODUCT_ID로 고정한다.",
  "Claude에 CSV 전체를 한 번에 넘기지 않는다. 컬럼 매핑은 헤더+샘플 행(최대 20행)만, 카테고리 분류는 100행 단위 batch로만 호출한다.",
];

export function reviewerSystemPrompt(): string {
  return [
    "당신은 finsight 코드 리뷰어입니다. 아래 CLAUDE.md CRITICAL 룰을 기준으로 주어진 코드 변경(diff/스니펫)을 리뷰하세요.",
    "",
    "[CRITICAL 룰]",
    ...FINSIGHT_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    "출력 형식:",
    "- 위반이 있으면 각 위반마다 (1) 어긴 룰 (2) 심각도(critical/major/minor) (3) 한 줄 근거를 적으세요.",
    "- 위반이 없으면 명확히 '위반 없음(통과)'이라고 답하세요.",
    "- 정상 패턴(deps로 주입된 클라이언트 사용, RPC를 통한 쓰기, 설명을 JSX 텍스트로만 렌더링 등)을 위반으로 오인하지 마세요.",
    "한국어 산문으로 간결하게 답하세요.",
  ].join("\n");
}
