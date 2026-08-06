# Step 9: deploy-production-hardening

## 읽어야 할 파일

- `/CLAUDE.md`
- `/docs/ARCHITECTURE.md`
- `/docs/ADR.md` (ADR-004, ADR-009)
- step 0~8에서 만들어진 전체 애플리케이션

**이 step은 핵심 기능이 전부 끝난 뒤에만 실행된다(step 0~8 완료가 전제).** GitHub↔Vercel 연결, 실제 배포, 프로덕션 전환은 여기서 처음 이뤄진다.

## 작업

### 1. Vercel 연결 (CLI 우선 시도)

```bash
vercel link --yes
```
이미 로그인/연결돼 있지 않으면 `vercel login`은 브라우저 인증이 필요해 무감독 세션에서 완료할 수 없다. 이 경우 `phases/mvp/index.json`의 이 step을 `"status": "blocked"`로, `"blocked_reason"`에 "Vercel 로그인/프로젝트 연결을 수동으로 완료해달라"고 기록하고 중단하라.

### 2. 환경변수 등록 (Preview = sandbox)

`vercel env add`로 `.env`에 있는 변수들을 Preview 환경에 등록한다(sandbox 값). `POLAR_SERVER=sandbox`로 둔다.

### 3. Fluid Compute / `maxDuration` 확인

Vercel 대시보드/CLI에서 Fluid Compute가 활성화돼 있는지, 이 프로젝트의 플랜에서 Function `maxDuration=300`이 실제로 허용되는지 확인한다. 허용되지 않으면(예: 구형 Hobby 플랜) `complete-upload`/처리 관련 route의 `maxDuration`을 실제 허용 상한으로 낮추고, `lib/csv` 상한(행 수 2,000)이 그 시간 안에 끝나는지 step 8에서 기록한 실측 시간과 비교해 재조정한다.

### 4. Preview 배포

```bash
vercel deploy
```

### 5. Polar sandbox webhook 등록 (수동 단계 필요)

Polar sandbox 대시보드에서 webhook 엔드포인트를 preview URL(`https://<preview>.vercel.app/api/webhooks/polar`)로 등록해야 한다 — 브라우저 대시보드 작업이라 이 step에서 직접 할 수 없으면 `blocked`로 표시하고 사용자에게 안내한다. 등록 후 `POLAR_WEBHOOK_SECRET`이 preview 환경변수와 일치하는지 확인한다.

### 6. Preview에서 수동 E2E

아래 흐름을 preview URL에서 직접 확인한다(가능하면 브라우저 자동화로, 아니면 결과를 `blocked`/summary에 기록):
1. 가입 → 확인 이메일 → `/auth/callback` → 대시보드(빈 상태)
2. CSV 업로드(5MB 근접 파일 포함) → 처리 중 → 완료 → 계좌별 대시보드에 카테고리 요약/월별 추이 표시
3. "Pro로 업그레이드" → Polar 체크아웃 → 결제 → webhook 수신 → `/billing/success` 폴링 → Pro 배지로 전환
4. `/settings/billing` → "구독 관리" → Polar Customer Portal 진입 확인
5. Free 히스토리 잠금 배너(3개월 이전 데이터가 있는 테스트 계정) 노출 확인

### 7. 최종 RLS/advisor 점검

`mcp__supabase__get_advisors`(또는 동등 툴)를 다시 실행해 새로 생긴 경고가 없는지 확인한다.

### 8. Production 전환 체크리스트 (문서화, 이 step에서 실제 전환까지는 안 함)

`docs/ARCHITECTURE.md` 또는 별도 `docs/DEPLOY.md`에 다음을 정리한다:
- Polar: production organization에서 Pro 상품을 별도로 다시 만들고 `POLAR_ACCESS_TOKEN`/`POLAR_PRO_PRODUCT_ID`/`POLAR_WEBHOOK_SECRET`을 production 값으로 교체, `POLAR_SERVER=production`
- Supabase Auth: production 도메인을 Site URL/Redirect URL에 추가
- Vercel: Production 환경변수를 sandbox와 분리해서 등록(Preview/Production 환경변수를 섞지 않는다)
- 위 항목이 전부 끝난 뒤 `vercel deploy --prod`로 최종 배포

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. Preview 배포 URL이 실제로 응답하는지(`curl -I <preview-url>`) 확인한다.
3. 6번의 수동 E2E 결과를 `phases/mvp/index.json`의 summary에 통과/실패 여부와 함께 기록한다.
4. 결과에 따라 `phases/mvp/index.json`의 step 9 항목을 업데이트한다. 전부 통과하면 MVP 전체가 완료된 것이다.

## 금지사항

- Polar/Vercel 브라우저 대시보드 작업을 억지로 CLI나 API 호출로 흉내내지 마라 — 안 되면 명확히 `blocked` 처리하고 사용자 개입을 요청하라.
- Production 전환(실제 `--prod` 배포, production Polar 상품 사용)을 이 step에서 실행하지 마라 — 체크리스트 문서화까지만 하고, 실제 전환은 사용자 확인 후 별도로 진행한다.
- sandbox와 production 환경변수를 같은 Vercel 환경(Preview/Production)에 섞어 넣지 마라.
- 기존 테스트를 깨뜨리지 마라.
