# 디자인

## 컨셉
finsight는 근접 무채색(흰 캔버스 + ink 텍스트) 기반의 조용하고 기관 금융 서비스 느낌의 디자인이다. 악센트 컬러는 Deep Azure(`#1C4ED8`) 하나뿐이고 주 CTA와 워드마크에만 아껴 쓴다. Claude Design으로 확정된 원본 디자인 시스템을 기반으로 한다.

## 핵심 규칙
- **색상**: 근접 무채색 + Deep Azure 단일 악센트. 빨강/초록(`--color-semantic-up/down`)은 거래 신호 텍스트 전용이며 버튼 배경으로 쓰지 않는다.
- **타이포**: Inter(본문/디스플레이), JetBrains Mono(모든 숫자·가격·퍼센트 — 다른 폰트로 재스타일링하지 않는다).
- **형태**: 버튼·인풋·검색창은 pill(100px radius), 카드는 24px radius, 아이콘 플레이트는 완전 원형. 인터랙티브 요소에 각진 모서리를 쓰지 않는다.
- **배경**: flat color만. 그라디언트·사진·일러스트·텍스처 없음. 다크 히어로 밴드(`#0E1013`) 위에 살짝 회전된 product-UI 카드 2~3장을 띄우는 게 유일한 구조적 모티프.
- **Elevation**: 거의 flat. 라이트 카드는 1px hairline border만, hover/floating 상태에 soft shadow 하나만 예외적으로 쓴다.
- **보이스**: 차분하고 단정적, sentence case(뱃지 eyebrow 제외 ALL CAPS 없음), 느낌표·긴급성 문구 없음, 이모지 없음.
- **아이콘**: 별도 아이콘 세트 없음. 필요하면 원형 플레이트 위 두 글자 모노그램으로 대체.
- **간격**: 4px 기본 단위, 섹션 간 96px, 카드 그리드 간 24px.

## 예외: 랜딩 페이지 다크 하이라이트 섹션

랜딩 페이지(`(marketing)/page.tsx`)의 "명세서 분석" 섹션(`StatementHighlight` 컴포넌트, raw CSV vs 정리된 결과 비교)에 한해 아래 예외를 허용한다. **대시보드·인증 등 실제 제품 화면에는 적용하지 않는다** — 그 화면들은 계속 라이트 캔버스 + flat 톤을 유지한다.

- 다크 히어로(`#0E1013`)와 동일한 배경 위에, 강조하려는 카드 하나에만 `--shadow-glow-primary` 토큰(Deep Azure 링 + soft glow)을 허용한다. 색상은 여전히 Deep Azure 단일 악센트 하나만 쓰고, 스크린샷 참고 자료에 있던 2색(블루+퍼플) 글로우는 도입하지 않았다 — 단일 악센트 원칙은 유지하면서 "글로우" 느낌만 가져온 절충이다.
- 글로우 카드 안의 큰 금액 텍스트는 Deep Azure가 아니라 흰색(`--color-on-dark`)을 쓴다. 다크 배경 위에서 Deep Azure 텍스트는 대비가 WCAG 기준(3:1)에 못 미쳐서다. 히어로의 기존 카드들과 동일한 패턴이다.
- 탭 전환(카테고리 톱/월별 추이)은 pill 버튼으로 구현하고, 새 아이콘·이모지·그라디언트는 추가하지 않았다.
- 이 섹션은 실제로 계산되는 값(`summarizeByCategory`/`summarizeByMonth`)만 보여준다. "이상 거래", "구독 누수" 같은 이 MVP에 없는 기능은 절대 언급하지 않는다 — `sample-preview.test.tsx`/`statement-highlight.test.tsx`에 이를 금지하는 가드 테스트가 있다.

## 실제 값 / 컴포넌트 / 화면 참조

정확한 CSS 토큰 값, shadcn/Tailwind 매핑 방법, 화면별(랜딩·인증·대시보드·업로드·결제) 레이아웃 참조 코드는 `.claude/skills/finsight-design-system/`에 있다 — UI/화면/컴포넌트 작업 시 `finsight-design-system` 스킬이 자동으로 이 내용을 불러와 참고한다. 사람이 직접 결과물을 보고 싶으면 같은 폴더의 `assets/*.html`을 브라우저로 열면 된다.
