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

## 실제 값 / 컴포넌트 / 화면 참조

정확한 CSS 토큰 값, shadcn/Tailwind 매핑 방법, 화면별(랜딩·인증·대시보드·업로드·결제) 레이아웃 참조 코드는 `.claude/skills/finsight-design-system/`에 있다 — UI/화면/컴포넌트 작업 시 `finsight-design-system` 스킬이 자동으로 이 내용을 불러와 참고한다. 사람이 직접 결과물을 보고 싶으면 같은 폴더의 `assets/*.html`을 브라우저로 열면 된다.
