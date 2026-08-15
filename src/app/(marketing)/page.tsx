import Link from "next/link"

import {
  CARD_HOVER_CLASS,
  SamplePreview,
} from "@/components/marketing/sample-preview"
import { StatementHighlight } from "@/components/marketing/statement-highlight"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const features = [
  {
    monogram: "매핑",
    title: "자동 컬럼 매핑",
    description: "은행마다 다른 CSV 형식을 인식해 필요한 거래 항목을 정리합니다.",
  },
  {
    monogram: "분류",
    title: "카테고리 자동 분류",
    description: "거래 내역을 분석해 식비, 교통, 쇼핑 같은 항목으로 분류합니다.",
  },
  {
    monogram: "추이",
    title: "계좌별 히스토리",
    description: "각 계좌의 카테고리별 지출과 월별 변화를 한눈에 확인합니다.",
  },
]

const plans = [
  {
    name: "Free",
    price: "무료",
    description: "가볍게 지출 흐름을 확인할 때",
    features: ["계좌 1개", "최근 3개월 히스토리", "카테고리별 지출 요약"],
    featured: false,
    ctaLabel: "Free로 시작",
    ctaHref: "/login?view=signup",
  },
  {
    name: "Pro",
    price: "월 9,900원",
    description: "여러 계좌를 오래 관리할 때",
    features: ["다중 계좌", "계좌별 무제한 히스토리", "월별 지출 추이"],
    featured: true,
    ctaLabel: "Pro로 시작",
    ctaHref: "/login?view=signup&returnTo=/settings/billing",
  },
]

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Finsight",
  description:
    "계좌 연동이나 마이데이터 인증 없이, CSV 명세서 업로드만으로 지출을 자동 분류하고 월별 추이를 확인하는 개인 가계부.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "KRW" },
    { "@type": "Offer", name: "Pro", price: "9900", priceCurrency: "KRW" },
  ],
}

function StartButton({ className = "" }: { className?: string }) {
  return (
    <Button asChild className={`h-12 px-6 text-base ${className}`}>
      <Link href="/login?view=signup">무료로 시작하기</Link>
    </Button>
  )
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <section className="overflow-hidden bg-[var(--color-surface-dark)] text-[var(--color-on-dark)]">
        <header className="mx-auto flex h-16 max-w-(--container-max) items-center justify-between px-6 sm:px-8">
          <Link
            href="/"
            className="font-heading text-lg font-semibold tracking-[-0.02em]"
          >
            finsight
          </Link>
          <nav aria-label="주요 메뉴" className="flex items-center gap-2 sm:gap-3">
            <Button
              asChild
              variant="ghost"
              className="text-[var(--color-on-dark)] hover:bg-white/10 hover:text-[var(--color-on-dark)]"
            >
              <Link href="/login">로그인</Link>
            </Button>
            <StartButton className="h-10 px-4 text-sm" />
          </nav>
        </header>

        <div className="mx-auto grid max-w-(--container-max) gap-12 px-6 pt-16 pb-24 sm:px-8 lg:grid-cols-2 lg:items-center lg:pt-20">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-white/10 text-[var(--color-on-dark)]"
              >
                개인 가계부
              </Badge>
              <Badge
                variant="secondary"
                className="bg-white/10 text-[var(--color-on-dark)]"
              >
                AI 절약 인사이트
              </Badge>
            </div>
            <h1 className="mt-6 max-w-[680px] font-heading text-5xl leading-[1.04] font-normal tracking-[-0.045em] text-balance sm:text-6xl lg:text-[80px]">
              지출을 있는 그대로, 이해하기 쉽게.
            </h1>
            <p className="mt-7 max-w-[460px] text-base leading-7 text-[var(--color-on-dark-soft)]">
              은행과 카드사에서 받은 CSV 명세서를 업로드하면 카테고리별
              지출과 월별 추이를 차분하게 정리해 드립니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <StartButton />
              <Button
                asChild
                variant="outline"
                className="h-12 border-white/30 bg-transparent px-6 text-base text-[var(--color-on-dark)] hover:bg-white/10 hover:text-[var(--color-on-dark)]"
              >
                <Link href="#pricing">요금제 보기</Link>
              </Button>
            </div>
          </div>

          <div
            aria-label="Finsight 지출 분석 미리보기"
            className="relative mx-auto h-[390px] w-full max-w-[500px] lg:h-[420px]"
          >
            <Card
              className={`absolute top-3 left-0 w-[280px] -rotate-3 bg-[var(--color-surface-dark-elevated)] py-2 text-[var(--color-on-dark)] shadow-[var(--shadow-glow-primary)] sm:w-[320px] ${CARD_HOVER_CLASS}`}
            >
              <CardContent className="p-6">
                <p className="text-sm text-[var(--color-on-dark-soft)]">
                  이번 달 지출
                </p>
                <p className="financial-number mt-3 text-3xl font-medium tracking-[-0.04em]">
                  1,284,500원
                </p>
                <p className="financial-number mt-3 text-sm text-[var(--color-semantic-up)]">
                  전월 대비 +6.5%
                </p>
              </CardContent>
            </Card>

            <Card
              className={`absolute right-0 bottom-4 w-[300px] rotate-3 bg-[var(--color-surface-dark-elevated)] py-2 text-[var(--color-on-dark)] shadow-[var(--shadow-glow-primary)] sm:w-[340px] ${CARD_HOVER_CLASS}`}
            >
              <CardContent className="p-6">
                <p className="mb-3 text-sm text-[var(--color-on-dark-soft)]">
                  카테고리 미리보기
                </p>
                <div className="flex items-center justify-between border-b border-white/10 py-3">
                  <span className="text-sm text-[var(--color-on-dark-soft)]">
                    식비
                  </span>
                  <span className="financial-number text-base">428,300원</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-[var(--color-on-dark-soft)]">
                    쇼핑
                  </span>
                  <span className="financial-number text-base">286,900원</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-(--container-max) px-6 py-24 sm:px-8"
      >
        <Badge variant="secondary">기능</Badge>
        <h2 className="mt-4 max-w-[680px] font-heading text-4xl leading-tight font-normal tracking-[-0.025em] sm:text-[44px]">
          CSV 한 장이면 지출 정리가 시작됩니다.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className={`border-border shadow-none ${CARD_HOVER_CLASS}`}
            >
              <CardContent className="p-6">
                <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-foreground">
                  {feature.monogram}
                </span>
                <h3 className="mt-6 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <SamplePreview />

      <StatementHighlight />

      <section id="pricing" className="bg-[var(--color-surface-soft)]">
        <div className="mx-auto max-w-(--container-max) px-6 py-24 sm:px-8">
          <div className="text-center">
            <Badge variant="secondary">요금제</Badge>
            <h2 className="mt-4 font-heading text-4xl font-normal tracking-[-0.025em]">
              필요한 만큼 선택하세요.
            </h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-[760px] gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.featured
                    ? `border-transparent bg-[var(--color-surface-dark)] text-[var(--color-on-dark)] shadow-[var(--shadow-glow-primary)] ${CARD_HOVER_CLASS}`
                    : `border-border shadow-none ${CARD_HOVER_CLASS}`
                }
              >
                <CardContent className="p-7">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="financial-number mt-5 text-3xl font-medium tracking-[-0.03em]">
                    {plan.price}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      plan.featured
                        ? "text-[var(--color-on-dark-soft)]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {plan.description}
                  </p>
                  <ul className="mt-7 space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${
                            plan.featured ? "bg-white" : "bg-foreground"
                          }`}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    asChild
                    variant={plan.featured ? "default" : "outline"}
                    className="mt-7 h-11 w-full"
                  >
                    <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-(--container-max) flex-col gap-8 px-6 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div>
            <p className="font-heading text-lg font-semibold text-primary">
              finsight
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              개인 지출을 조용하고 명확하게 정리합니다.
            </p>
          </div>
          <nav aria-label="하단 메뉴" className="flex flex-wrap gap-6 text-sm">
            <Link href="#features" className="hover:text-primary">
              기능
            </Link>
            <Link href="#pricing" className="hover:text-primary">
              요금제
            </Link>
            <Link href="/login" className="hover:text-primary">
              로그인
            </Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
