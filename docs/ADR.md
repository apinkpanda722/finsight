# Architecture Decision Records

## 철학
MVP 속도 최우선이되, 실제 플랫폼 제약(Vercel 요청 본문 한도, LLM 출력 신뢰성)과 금융 데이터의 민감도는 타협하지 않는다. 무감독으로 실행되는 harness step이 안전하게 동작하도록, 모호한 분기보다 명확히 고정된 결정과 DB 레벨 강제를 선호한다.

---

### ADR-001: Next.js 15로 메이저 버전 고정
**결정**: `create-next-app@15`로 버전을 명시적으로 고정한다.
**이유**: Next.js 16부터 `middleware.ts`가 `proxy.ts`로 개명되고 Edge 런타임을 지원하지 않는다. harness step이 무감독으로 실행되므로 "버전을 감지해서 분기"하는 로직 자체가 실수 여지가 된다.
**트레이드오프**: Next.js 16의 신규 기능을 못 쓴다. 필요해지면 의도적으로 마이그레이션한다.

### ADR-002: 구독 스냅샷을 profiles에 직접 저장
**결정**: `subscriptions` 테이블을 따로 두지 않고 `plan`/`subscription_status`/`polar_subscription_id`/`current_period_end`/`cancel_at_period_end`/`polar_modified_at`을 `profiles`에 직접 둔다.
**이유**: 사용자당 활성 구독은 항상 최대 1개뿐이다. webhook 처리가 단일 조건부 UPDATE로 끝나 원자적이고, `polar_modified_at`으로 stale/역순 이벤트를 걸러 최신 권한이 되돌아가지 않게 한다.
**트레이드오프**: 과거 구독 이력을 보존하지 않는다. MVP에 구독 히스토리 UI 요구사항이 없다.

### ADR-003: CSV는 결정론적으로 파싱하고 Claude는 컬럼 매핑·카테고리 분류로만 제한
**결정**: 전체 CSV를 Claude에 넘겨 거래 전체를 추출시키지 않는다. 대신 (1) 헤더+샘플(최대 20행)로 컬럼 매핑을 1회 추론하고, (2) 실제 날짜/금액/부호 변환은 결정론적 코드로 수행하며, (3) 카테고리 분류만 100행 단위 batch로 Claude에 요청한다. 각 batch는 rowIndex 완전성을 검증하고, 최종적으로 전체 건수와 source debit/credit 합계를 대조(reconciliation)한다.
**이유**: 한 번에 2,000행 분량의 JSON을 반환시키면 출력이 잘려 거래가 조용히 누락될 위험이 있고, 날짜·금액처럼 정확해야 하는 값을 LLM이 재작성하면 환각 위험이 있다. 범위를 좁히면 토큰 비용과 프롬프트 인젝션 노출면도 함께 줄어든다.
**트레이드오프**: 파싱 로직(RFC 4180 CSV parser, 부호 변환 규칙)을 직접 구현·유지해야 한다. 컬럼 매핑 추론이 틀리면 이후 결정론적 변환 전체가 틀어지므로, 매핑 결과의 유효성 검증(실제 날짜/금액 파싱 성공 여부)이 중요하다.

### ADR-004: CSV는 Supabase Storage에 직접 업로드, Vercel Function은 거치지 않음
**결정**: 클라이언트가 signed upload URL로 Storage에 원본을 직접 올리고, Vercel Function(API route)에는 JSON 메타데이터만 오간다.
**이유**: 파일이 최대 5MB인데 Vercel Function의 요청 본문 한도는 4.5MB다. multipart로 Function을 통과시키면 그 자체로 413 에러가 난다. 서버는 대신 원본을 Storage에서 다시 읽어 `complete-upload`에서 실제 크기·인코딩·구조를 검증한다(클라이언트가 보낸 값은 신뢰하지 않음).
**트레이드오프**: 업로드 플로우가 init-upload/직접 업로드/complete-upload 세 단계로 늘어나고, signed URL 재발급(네트워크 실패 대비) 경로가 추가로 필요하다.

### ADR-005: 사용자 소유 리소스는 composite FK로 cross-user 연결을 DB 레벨에서 차단
**결정**: `uploaded_statements`에 `unique (user_id, id)`를 두고, 이를 참조하는 `transactions`는 `foreign key (user_id, statement_id) references uploaded_statements(user_id, id)` 형태의 composite FK를 쓴다.
**이유**: RLS는 SELECT를 지키지만, service_role로 실행되는 서버 코드의 버그(예: statement_id는 맞는데 user_id를 잘못 채움)까지 막지는 못한다. composite FK는 그런 버그가 있어도 INSERT 자체를 거부한다.
**트레이드오프**: 스키마가 약간 더 장황해진다. 이 정도 방어 심도는 금융 데이터를 다루는 앱에서 정당하다고 판단했다.
> ADR-011로 `accounts` 테이블이 제거되면서, 이 패턴이 적용되는 관계는 `transactions → uploaded_statements` 하나만 남았다.

### ADR-006: 처리 실패는 5분 lease + 명시적 retry로 복구, 무한 자동 재시도는 하지 않는다
**결정**: 백그라운드 처리는 `processing_lease_expires_at`을 기록한다. Claude 호출의 일시적 오류(429/5xx/네트워크)는 그 호출 안에서 지수 backoff로 최대 3회까지만 자동 재시도한다. lease가 만료되도록 처리 자체가 죽으면(`after()`가 durable queue가 아니므로 가능) 자동으로 다시 시도하지 않고, 사용자가 `POST /api/statements/{id}/retry`로 명시적으로 재개한다.
**이유**: `after()`는 route의 `maxDuration` 안에서만 보장되는 best-effort 실행이라 완전한 durable queue를 흉내 낼 수 없다. 이미 성공한 컬럼 매핑까지 버리고 매번 처음부터 자동 재시도를 반복하면 비용만 늘고 실패 원인을 파악하기 어렵다. 명시적 retry는 `finalize_statement`의 `row_index` unique 제약 덕에 중복 거래 없이 안전하게 재개된다.
**트레이드오프**: 드물게 처리가 멈추면 사용자가 직접 재시도 버튼을 눌러야 한다. 실사용에서 자주 발생하면 자동 재개(cron 등)를 fast-follow로 검토한다.

### ADR-007: Free 히스토리 잠금 여부는 실제 데이터 없이 RPC로만 노출
**결정**: `has_locked_history()` security-definer RPC가 인자 없이 `auth.uid()`만으로 "이 사용자가 Free이고 현재 달 포함 최근 3개 달보다 오래된 완료 statement가 있는가"를 boolean으로만 반환한다.
**이유**: UI가 "더 오래된 데이터가 있습니다" 배너를 보여주려면 존재 여부를 알아야 하는데, RLS로 막힌 실제 거래를 클라이언트가 우회 조회하게 만들 수는 없다. RPC가 boolean만 반환하면 실제 금액/날짜는 절대 노출되지 않는다.
**트레이드오프**: 없음 — RLS로 거래 자체를 보호하면서도 UX에 필요한 최소 신호만 안전하게 전달하는 패턴이라 순수 이득이다.

### ADR-008: Checkout/Portal은 same-origin POST, 레이트리미팅은 Postgres RPC
**결정**: Polar checkout/portal 세션 생성은 GET 쿼리 대신 인증된 same-origin POST로 처리하고 서버가 product/customer를 고정한다. 업로드 레이트리미팅은 Upstash 같은 별도 서비스 없이 `create_statement_upload` RPC의 `pg_advisory_xact_lock` + 삭제 불가능한 `upload_usage` 테이블로 처리한다.
**이유**: GET 기반 결제 라우트는 CSRF(타인 계정에 구독 연결) 노출면이 있다. 레이트리미팅은 이미 있는 Postgres로 충분하고, statement를 삭제해도 `upload_usage`는 남아 비용 남용을 우회할 수 없다.
**트레이드오프**: 여러 리전에 걸친 완벽한 원자성은 아니지만 MVP 트래픽 규모에서는 충분하다.

### ADR-009: Vercel 연결/배포는 핵심 구현 완료 후 진행
**결정**: GitHub↔Vercel 연결과 실제 배포는 별도 조기 단계로 두지 않고 마지막 step(`deploy-production-hardening`)에서 수행한다.
**이유**: 초기 버전은 조기 배포로 플랫폼 특이 문제를 일찍 발견하는 것을 고려했으나, 가장 큰 Vercel 특이 리스크(Function 4.5MB 요청 본문 한도)는 이미 ADR-004로 설계 단계에서 해결했다. 나머지 구현(DB, 인증, 결제, 파싱)은 로컬 개발로 충분히 검증 가능하다.
**트레이드오프**: ADR-004 이후 새로 발견되는 Vercel 특이 이슈가 있다면 조기 배포보다 늦게 발견된다. 발견되면 해당 시점에 대응한다.

### ADR-010: 로그인에 Google OAuth를 이메일/비밀번호와 병행 추가
**결정**: Supabase Auth의 Google provider를 활성화해 기존 이메일/비밀번호 인증과 나란히 제공한다. 별도 회원가입 페이지나 콜백 라우트를 새로 만들지 않는다 — 로그인 페이지에 `supabase.auth.signInWithOAuth({ provider: 'google' })` 버튼을 추가하고, 기존 `src/app/(auth)/auth/callback/route.ts`의 `exchangeCodeForSession`을 그대로 재사용한다(이 함수는 provider에 무관하게 동작).
**이유**: Google 계정 사용자는 이메일 인증 단계 없이 즉시 온보딩할 수 있어 전환율이 높다. Supabase가 OAuth code exchange를 provider-agnostic하게 처리하므로 콜백 라우트 재사용이 가능해 구현 범위가 로그인 페이지 버튼 추가 + Supabase/Google 콘솔 설정으로 좁혀진다.
**트레이드오프**: 같은 이메일이어도 이메일/비밀번호 계정과 Google 계정이 자동으로 병합되지 않는다(Supabase 기본 동작) — 사용자가 두 방식을 오가며 가입하면 별도 계정이 생길 수 있다. MVP는 이 계정 병합 케이스를 별도로 처리하지 않는다.

### ADR-011: `accounts`(계좌) 엔티티를 제거하고 명세서는 사용자에 직접 귀속
**결정**: `accounts` 테이블과 계좌 선택/생성 UI(`AccountChips`, "신규 계좌 이름" 입력, 대시보드 계좌 전환)를 전부 제거한다. 명세서(`uploaded_statements`)와 거래(`transactions`)는 `user_id`로 사용자에 직접 귀속되고, 대시보드는 모든 명세서를 합친 단일 통합 뷰만 보여준다. 은행/카드명은 업로드된 파일에서 파싱한 표시용 텍스트 라벨(`uploaded_statements.detected_label`)로만 남기고, 별도 정규화 엔티티나 FK로 만들지 않는다. 라벨 추론은 새 Claude 호출을 추가하지 않고, 기존 컬럼 매핑 추론(ADR-003) 응답 스키마에 필드를 추가하는 방식으로 처리한다.
**이유**: 업로드 필수 입력값이던 "계좌 선택 또는 신규 계좌 이름 입력"이 Radix Dialog의 모달 특성(배경 `pointer-events` 차단)과 충돌해, 팝업이 이미 열린 상태에서는 계좌가 없는 신규 사용자가 그 값을 채울 방법이 없는 실사용 버그로 이어졌다. 더 근본적으로, 이 입력을 사용자가 직접 타이핑하게 만드는 것 자체가 불필요한 마찰이었다 — 은행/카드명은 명세서 파일 자체에 이미 들어있는 정보라 파싱으로 대체 가능하다.
**트레이드오프**: 여러 은행/카드의 거래가 자동으로 하나의 통합 뷰에 합쳐진다 — 원래 PRD가 fast-follow로 미뤄뒀던 "여러 계좌 합산 뷰"가 사실상 기본 동작이 된다. 계좌별로 지출을 나눠보고 싶은 사용자는 이 MVP에서 지원하지 않는다(라벨은 표시용일 뿐 필터링에 쓰이지 않음). Free/Pro 차별화 축에서 "계좌 개수 제한"이 빠지므로 요금제 모델도 함께 바뀐다(PRD 참고).

### ADR-012: Pro 전용 PDF 분석 리포트 내보내기
**결정**: Pro 사용자에게 카테고리별 지출 + 월별 추이를 담은 PDF 리포트 다운로드 기능을 제공한다. 생성은 `pdf-lib`(기존 `devDependencies`에서 `dependencies`로 승격, 샘플 명세서 PDF 생성 스크립트가 이미 이 라이브러리를 사용 중이었다)로 서버에서 수행하고, 리포트 내용은 기존 대시보드 집계 로직(`dashboardInsightService`의 `summarizeByCategory`/`summarizeByMonth`)을 그대로 재사용한다.
**이유**: PRD에 이미 fast-follow 항목으로 있던 "PDF/엑셀 리포트 내보내기" 중 PDF만 먼저 구현하기로 했다(엑셀은 별도 라이브러리 도입이 필요해 범위를 나눔). 계좌 개수 제한이 빠지면서 사라진 Pro 차별화 요소를 대체한다. 리포트 집계 로직을 새로 만들지 않고 대시보드와 동일한 계산을 재사용해 두 화면의 숫자가 어긋날 위험을 없앤다.
**트레이드오프**: 엑셀 내보내기, 계좌/카드별 리포트 분리 같은 세부 기능은 이번 범위에 없다(fast-follow). PDF 레이아웃이 단순한 텍스트/표 수준으로 시작하며, 시각적으로 정교한 리포트는 이후 개선 대상이다.

**한글 폰트 임베딩(추가 결정)**: 카테고리명("식비", "교통" 등)이 전부 한글이라, 서버(Vercel) 환경에 시스템 한글 폰트가 없는 문제를 폰트 파일 번들링으로 해결해야 했다.
- **폰트**: Google Fonts 공식 저장소(`google/fonts`, SIL OFL 라이선스)의 Nanum Gothic 정적(non-variable) TTF(Regular/Bold)를 `src/assets/fonts/`에 커밋한다. Noto Sans KR은 가변 폰트(`[wght].ttf`)만 배포되는데, pdf-lib+fontkit 조합에서 가변 폰트를 임베딩하면 한글 조합 글리프 일부가 무작위로 깨지는 문제를 실제로 확인해 정적 폰트로 대체했다.
- **`subset: false` 필수**: `doc.embedFont(bytes, { subset: true })`로 서브셋 압축을 하면 정적 폰트에서도 동일하게 글리프가 깨진다(pdf-lib/fontkit의 한글 서브셋 처리 버그로 추정). `subset: false`로 폰트 전체를 그대로 임베딩해야 한다 — 생성되는 PDF가 커지지만(폰트당 수백 KB) 리포트 다운로드 용도로는 허용 가능한 수준이다.
- **트레이드오프**: 폰트 파일이 리포지토리에 약 4MB(Regular+Bold) 추가된다. 서버 사이드 전용이라 클라이언트 번들에는 포함되지 않는다.
