# 배포 가이드 (DEPLOY.md)

## 현재 상태 (Preview)

- Vercel 프로젝트: `tommy-00c8/finsight` (`vercel link`로 연결됨)
- 안정 Preview 도메인: `https://finsight-preview.vercel.app` (매 `vercel deploy`마다 새로 생기는 랜덤 URL에 `vercel alias set <새 배포 URL> finsight-preview.vercel.app`으로 재연결해서 고정)
- Preview 환경변수: `.env`의 sandbox 값을 그대로 Vercel **Preview** 환경에 등록(`POLAR_SERVER=sandbox`)
- Deployment Protection(SSO)이 `all_except_custom_domains`로 켜져 있어, 외부 요청(Polar webhook 등)은 프로젝트에 이미 생성된 **Protection Bypass 토큰**을 쿼리 파라미터로 붙여야 통과한다:
  ```
  https://finsight-preview.vercel.app/api/webhooks/polar?x-vercel-protection-bypass=<토큰>&x-vercel-set-bypass-cookie=true
  ```
  토큰은 `vercel curl` 실행 시 자동 생성되며, Vercel 프로젝트 설정 → Deployment Protection에서도 확인 가능하다.
- GitHub 저장소(`apinkpanda722/finsight`)는 Vercel 대시보드 → Account → Login Connections에서 GitHub 연결 후 `vercel git connect`로 정상 연결했다(`main`이 production 브랜치). 이제 `main` push 시 Vercel이 자동으로 Preview/Production 배포를 만든다.

## Production 전환 체크리스트 (미실행 — 문서화만)

아래 항목을 모두 마친 뒤에만 `vercel deploy --prod`로 최종 배포한다. 이 문서 작성 시점에는 실행하지 않았다.

1. **Polar production 상품 재생성**
   - `https://polar.sh`(sandbox 아님)에 로그인 → organization 생성 → Pro 단일 recurring 상품 생성
   - 새 `POLAR_ACCESS_TOKEN`, `POLAR_PRO_PRODUCT_ID`, `POLAR_WEBHOOK_SECRET` 발급
   - Vercel **Production** 환경에 위 값 + `POLAR_SERVER=production` 등록 (Preview 값과 절대 섞지 않는다)
   - Production webhook endpoint를 실제 production 도메인의 `/api/webhooks/polar`로 등록

2. **Supabase Auth production 도메인 등록**
   - Supabase 콘솔 → Authentication → URL Configuration
   - `Site URL`을 production 도메인으로 갱신(또는 유지하되 Redirect URLs에 추가)
   - `Redirect URLs`에 `https://<production-domain>/**` 추가

3. **Vercel Production 환경변수 등록**
   - `.env`의 나머지 값(Supabase, Anthropic 키 등)을 Vercel **Production** 환경에 별도로 등록
   - Preview 환경변수를 복사해오지 말고 production 전용 값으로 새로 채운다 — 특히 Polar 관련 키는 반드시 1번에서 발급한 production 값을 사용한다
   - `SUCCESS_URL`을 production 도메인 기준(`https://<production-domain>/billing/success`)으로 등록

4. **최종 배포**
   - 위 1~3이 모두 끝난 뒤 `vercel deploy --prod` 실행
   - 배포 후 `curl -I <production-domain>`으로 응답 확인
   - Production에서 실제 결제(소액) 1건으로 Polar webhook → `profiles.plan` 갱신까지 재확인 권장

## 알아두면 좋은 점 (이번 Preview 검증 중 발견)

- **pdfjs-dist는 Vercel 서버리스 환경에서 두 가지 별개의 문제를 낸다 — 둘 다 로컬 dev 서버에서는 재현되지 않고 Vercel 프로덕션 빌드에서만 드러난다.** PDF 관련 코드를 건드릴 일이 있으면 반드시 실제 Preview 배포로 재확인한다.
  1. **`DOMMatrix is not defined`**: 모듈 로드 시점에 브라우저 전용 API를 참조해서 CSV 업로드까지 같이 500 에러가 난다. `@napi-rs/canvas`를 의존성으로 추가하고 `src/lib/pdf/canvas-polyfill.ts`를 `pdfjs-dist` import 전에 정적으로 import해서 폴리필한다(`src/lib/pdf/parse.ts` 참고). `next.config.ts`의 `serverExternalPackages`에 `@napi-rs/canvas`도 포함되어 있어야 한다.
  2. **`Cannot find module '.../pdfjs-dist/legacy/build/pdf.worker.mjs'`**: pdfjs-dist가 내부적으로 동적 import하는 워커 파일이 Next.js output file tracing에서 누락되어 실제 PDF만 업로드 시 `invalid_pdf`로 실패한다(CSV는 이 경로를 안 타서 영향 없음). `next.config.ts`의 `outputFileTracingIncludes`에 `"/api/statements/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"]`를 추가해서 해결했다.
- Vercel 신규 프로젝트의 **첫 배포는 `--prod` 없이 실행해도 자동으로 production target으로 배정된다**(플랫폼 동작). 이후 배포부터는 정상적으로 preview target이 된다.
- Preview 배포는 매번 새 URL이 발급되므로, Polar webhook/`SUCCESS_URL`처럼 고정 URL이 필요한 곳에는 `vercel alias`로 안정 도메인을 만들어 쓴다.
