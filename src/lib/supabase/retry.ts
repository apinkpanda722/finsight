import type { PostgrestError } from "@supabase/supabase-js"

const CLOCK_SKEW_ERROR_CODE = "PGRST303"
const DEFAULT_RETRY_DELAY_MS = 800

/**
 * Supabase Auth와 PostgREST 사이의 미세한 clock skew로, 로그인 직후 발급된 JWT가
 * "issued at future"(PGRST303)로 거부되는 경우가 있다. 이 창은 1초 미만으로 해소되므로
 * 짧은 지연 후 한 번만 재시도한다.
 */
export async function withClockSkewRetry<
  TResponse extends { error: PostgrestError | null },
>(
  run: () => PromiseLike<TResponse>,
  retryDelayMs: number = DEFAULT_RETRY_DELAY_MS
): Promise<TResponse> {
  const result = await run()

  if (result.error?.code !== CLOCK_SKEW_ERROR_CODE) {
    return result
  }

  await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
  return run()
}
