import Anthropic from "@anthropic-ai/sdk"

import { getServerEnv } from "@/lib/env"

export function createAnthropicClient(): Anthropic {
  return new Anthropic({
    apiKey: getServerEnv().ANTHROPIC_API_KEY,
    maxRetries: 0,
  })
}
