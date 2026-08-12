import Anthropic from "@anthropic-ai/sdk"

export async function smokeCheckSummary(text: string) {
  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 100,
    messages: [{ role: "user", content: text }],
  })
  return response
}
