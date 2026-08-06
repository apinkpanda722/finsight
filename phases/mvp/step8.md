# Step 8: integration-verification

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md`
- step 1~7에서 만들어진 전체 스키마·RPC·서비스·라우트

**이 step은 새 기능을 추가하지 않는다.** 지금까지의 구현을 가로지르는 통합 시나리오를 자동 테스트로 굳히는 것이 목적이다. 테스트 가능성을 위해 기존 함수를 export하는 정도의 최소 변경은 허용되지만, 동작을 바꾸지 마라.

## 작업

이 테스트들은 실제(또는 로컬) Supabase 프로젝트와의 연결이 필요하다(step 1에서 이미 `.env`에 구성됨) — 모킹으로는 advisory lock, RLS, composite FK 같은 DB 레벨 보장을 검증할 수 없다. `*.integration.test.ts` 네이밍으로 구분한다.

### 1. CSV fixture 테스트

- 2,000행 CSV(상한 정확히 채움), quoted multiline 필드 포함 CSV, UTF-8(BOM 포함/미포함), CP949 CSV 각각의 fixture를 `src/test/fixtures/`에 추가하고, 업로드→검증→파싱 전체 파이프라인을 실행해 모든 `row_index`가 정확히 한 번씩 저장되고 총 건수가 `row_count`와 일치하는지 확인한다.

### 2. 동시성/원자성 테스트

- **동시 Free account 생성**: 같은 Free 사용자로 `create_statement_upload`를 동시에 두 번(서로 다른 `new_account_label`로) 호출했을 때 하나만 성공하고 다른 하나는 `upgrade_required`로 실패하는지 확인한다.
- **삭제 후 quota 유지**: statement를 업로드→삭제한 뒤 `upload_usage` 카운트가 줄지 않았는지, 즉 삭제로 일 10회 제한을 우회할 수 없는지 확인한다.
- **processing lease 재개**: `processing_lease_expires_at`을 과거로 강제 설정한 뒤 `retry` 엔드포인트가 CAS로 재획득해 성공적으로 완료까지 이어지는지 확인한다. 유효한(만료 안 된) lease를 가진 statement에는 재획득이 실패하는지도 함께 확인한다.

### 3. Webhook 권한/정합성 테스트

- **stale/역순 webhook**: `modifiedAt`이 현재 `profiles.polar_modified_at`보다 과거인 이벤트를 보내 `plan`이 되돌아가지 않는지 확인한다.
- **Free/잘못된 product 거부**: `POLAR_PRO_PRODUCT_ID`와 다른 product의 `subscription.active` 이벤트가 `plan`을 바꾸지 않는지 확인한다.
- **subscription.revoked**: payload의 최종 상태가 `canceled`일 때 `plan='free'`로 정확히 전환되는지 확인한다.

### 4. RLS 회귀 테스트

- **Free 과거 데이터 직접 조회 차단**: 앱 코드를 거치지 않고 `anon`/`authenticated` 키로 만든 Supabase 클라이언트로 Free 테스트 계정의 3개월보다 오래된 거래를 직접 `select`했을 때 빈 결과가 나오는지 확인한다(RLS가 route 계층이 아니라 DB 계층에서 막는다는 것의 증거).
- **composite FK 거부**: 다른 사용자의 `account_id`/`statement_id`를 자신의 `user_id`와 조합해 `uploaded_statements`/`transactions`에 넣으려 하면 FK 위반으로 거부되는지 확인한다(service_role로 직접 시도).

### 5. Anthropic 실 API smoke test (제한적, 기본적으로 skip)

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
3. 위 1~4번 시나리오가 전부 통과하는지 확인한다.
4. 결과에 따라 `phases/mvp/index.json`의 step 8 항목을 업데이트한다(summary에 2,000행 fixture의 실측 토큰/시간 포함).

## 금지사항

- 이 step에서 새로운 사용자 대면 기능을 추가하지 마라 — 검증만 한다.
- Anthropic smoke test를 기본 `npm test`에서 매번 실행되게 만들지 마라 — 이유: 반복 실행마다 실제 비용이 발생한다.
- RLS/FK 회귀 테스트를 우회하기 위해 테스트 안에서 `service_role`로 RLS를 끄고 검증하지 마라 — `anon`/`authenticated` 클라이언트로 실제 사용자 권한을 재현해야 의미가 있다.
- 기존 테스트를 깨뜨리지 마라.
