import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#0E1013",
          color: "#FFFFFF",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 28,
            fontWeight: 700,
            color: "#1C4ED8",
          }}
        >
          finsight
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 56,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          계좌 연동 없이, CSV로 쓰는 가계부
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 28,
            color: "#A9ACB3",
          }}
        >
          은행 인증 없이 CSV 업로드만으로 지출을 자동 분류합니다
        </div>
      </div>
    ),
    { ...size }
  )
}
