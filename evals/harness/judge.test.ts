import { describe, expect, it } from "vitest";

import { JudgeVerdictSchema, judgeUserContent, qaJudgeUserContent } from "./judge";

describe("JudgeVerdictSchema", () => {
  it("verdict는 pass/fail만 허용한다", () => {
    expect(
      JudgeVerdictSchema.safeParse({ verdict: "pass", reasoning: "ok" }).success,
    ).toBe(true);
    expect(
      JudgeVerdictSchema.safeParse({ verdict: "maybe", reasoning: "x" }).success,
    ).toBe(false);
  });
});

describe("judgeUserContent", () => {
  it("기대 라벨과 리뷰어 출력을 함께 담는다", () => {
    const content = judgeUserContent({
      rule: "라우트는 RPC로만 쓴다",
      expect: "violation",
      severity: "critical",
      reviewerOutput: "critical 위반입니다",
    });

    expect(content).toContain("라우트는 RPC로만 쓴다");
    expect(content).toContain("violation");
    expect(content).toContain("critical 위반입니다");
  });
});

describe("qaJudgeUserContent", () => {
  it("질문·must·mustNot·답변을 함께 담는다", () => {
    const content = qaJudgeUserContent({
      question: "getSession()을 써도 되나요?",
      must: ["getClaims/getUser만 사용한다", "서버측 무효화를 확인 안 함이 이유다"],
      mustNot: ["getSession()을 써도 된다"],
      answer: "getSession()은 쓰면 안 됩니다.",
    });

    expect(content).toContain("getSession()을 써도 되나요?");
    expect(content).toContain("getClaims/getUser만 사용한다");
    expect(content).toContain("서버측 무효화를 확인 안 함이 이유다");
    expect(content).toContain("getSession()을 써도 된다");
    expect(content).toContain("getSession()은 쓰면 안 됩니다.");
  });

  it("mustNot이 비면 '(없음)'으로 표기한다", () => {
    const content = qaJudgeUserContent({
      question: "q",
      must: ["사실"],
      mustNot: [],
      answer: "a",
    });

    expect(content).toContain("(없음)");
  });
});
