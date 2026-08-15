import { describe, expect, it } from "vitest";

import { responderSystemPrompt } from "./responder";

describe("responderSystemPrompt", () => {
  it("라이브 CLAUDE.md를 컨텍스트로 그대로 담는다", () => {
    const prompt = responderSystemPrompt("## 아키텍처 규칙\n- CRITICAL: 예시 룰");

    expect(prompt).toContain("[CLAUDE.md]");
    expect(prompt).toContain("## 아키텍처 규칙\n- CRITICAL: 예시 룰");
  });

  it("틀린 전제 반박과 환각 금지를 지시한다", () => {
    const prompt = responderSystemPrompt("");

    expect(prompt).toContain("전제가 틀렸으면");
    expect(prompt).toContain("지어내지");
  });
});
