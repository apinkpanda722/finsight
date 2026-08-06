# Step 8: integration-verification

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- step 1~7에서 만들어진 전체 스키마·RPC·서비스·라우트

**이 step은 새 기능을 추가하지 않는다.** 지금까지의 구현을 가로지르는 통합 시나리오를 자동 테스트로 굳히는 것이 목적이다. 테스트 가능성을 위해 기존 함수를 export하는 정도의 최소 변경은 허용되지만, 동작을 바꾸지 마라.

## 작업

이 테스트들은 실제(또는 로컬) Supabase 프로젝트와의 연결이 필요하다(step 1에서 이미 `.env`에 구성됨) — 모킹으로는 advisory lock, RLS, composite FK, 실제 PostgREST 필터 문법 같은 DB 레벨 보장을 검증할 수 없다. `*.integration.test.ts` 네이밍으로 구분한다.

**범위 경계 — 중복 금지**: step 4(webhook 로직), step 5(CSV 인코딩/파싱), step 6(2,000행 fixture 전체 파이프라인 1회 실행, lease CAS 단위 테스트)에서 이미 mock으로 검증한 로직을 여기서 다시 fixture 재실행하거나 재검증하지 마라 — 이 step은 **모킹으로는 검증 불가능한 것**(진짜 동시 요청, 진짜 RLS, 진짜 FK, 진짜 외부 API)만 다룬다.

### 1. 동시성/원자성 테스트

- **동시 Free account 생성**: 같은 Free 사용자로 `create_statement_upload`를 동시에 두 번(서로 다른 `new_account_label`로) 호출했을 때 하나만 성공하고 다른 하나는 `upgrade_required`로 실패하는지 확인한다.
- **삭제 후 quota 유지**: statement를 업로드→삭제한 뒤 `upload_usage` 카운트가 줄지 않았는지, 즉 삭제로 일 10회 제한을 우회할 수 없는지 확인한다.

### 2. Webhook stale 필터의 실제 DB 동작 확인

step 4는 mock Supabase로 `handlePolarWebhookEvent`의 로직만 검증했다 — `.or('polar_modified_at.is.null,polar_modified_at.lt.' + modifiedAt)` 같은 PostgREST 필터 문법 자체가 실제 Postgres에서 의도대로 동작하는지는 아직 검증되지 않았다. 실제 `profiles` row에 대해 최신 이벤트 적용 후 과거 `modifiedAt` 이벤트를 보내 `plan`이 되돌아가지 않는지 1개 시나리오만 real DB로 확인한다(다른 webhook 로직 케이스는 step 4에서 이미 충분하다).

### 3. RLS 회귀 테스트

- **Free 과거 데이터 직접 조회 차단**: 앱 코드를 거치지 않고 `anon`/`authenticated` 키로 만든 Supabase 클라이언트로 Free 테스트 계정의 3개월보다 오래된 거래를 직접 `select`했을 때 빈 결과가 나오는지 확인한다(RLS가 route 계층이 아니라 DB 계층에서 막는다는 것의 증거).
- **composite FK 거부**: 다른 사용자의 `account_id`/`statement_id`를 자신의 `user_id`와 조합해 `uploaded_statements`/`transactions`에 넣으려 하면 FK 위반으로 거부되는지 확인한다(service_role로 직접 시도).

### 4. Anthropic 실 API smoke test (제한적, 기본적으로 skip)

작은 실제 CSV(10행 이하)로 전체 파이프라인을 **실제 Anthropic API**로 1회 실행하는 테스트를 작성하되, 환경변수 `RUN_LIVE_ANTHROPIC_SMOKE=1`이 없으면 자동으로 skip하도록 만든다(`npm test`를 반복 실행할 때마다 비용이 나가지 않게). 이 테스트를 이 step에서 `RUN_LIVE_ANTHROPIC_SMOKE=1 npm test`로 직접 1회 실행하고, 실제 소요 토큰/시간을 기록해 커밋 메시지나 `phases/mvp/index.json`의 summary에 남긴다.

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다(Anthropic smoke test는 기본 skip 상태로 통과해야 한다).
2. `RUN_LIVE_ANTHROPIC_SMOKE=1 npm test`를 별도로 1회 실행해 실 API 경로가 실제로 동작하는지 확인하고 토큰/시간을 기록한다.
3. 동시성/원자성, webhook stale 필터, RLS, composite FK 시나리오가 전부 통과하는지 확인한다.
4. 결과에 따라 `phases/mvp/index.json`의 step 8 항목을 업데이트한다.

## 금지사항

- 이 step에서 새로운 사용자 대면 기능을 추가하지 마라 — 검증만 한다.
- Anthropic smoke test를 기본 `npm test`에서 매번 실행되게 만들지 마라 — 이유: 반복 실행마다 실제 비용이 발생한다.
- RLS/FK 회귀 테스트를 우회하기 위해 테스트 안에서 `service_role`로 RLS를 끄고 검증하지 마라 — `anon`/`authenticated` 클라이언트로 실제 사용자 권한을 재현해야 의미가 있다.
- 기존 테스트를 깨뜨리지 마라.
