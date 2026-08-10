import type { PostgrestError } from "@supabase/supabase-js"

const CLOCK_SKEW_ERROR_CODE = "PGRST303"
const DEFAULT_RETRY_DELAY_MS = 800
const MAX_ATTEMPTS = 3

/**
 * Supabase Auth와 PostgREST 사이의 미세한 clock skew로, 로그인 직후 발급된 JWT가
 * "issued at future"(PGRST303)로 거부되는 경우가 있다. 보통 1초 안에 해소되지만
 * 드물게 더 오래가는 경우가 있어, 매 시도 사이 지연을 두고 최대 3회까지 재시도한다.
 */
export async function withClockSkewRetry<
  TResponse extends { error: PostgrestError | null },
>(
  run: () => PromiseLike<TResponse>,
  retryDelayMs: number = DEFAULT_RETRY_DELAY_MS
): Promise<TResponse> {
  let result = await run()

  for (
    let attempt = 1;
    attempt < MAX_ATTEMPTS && result.error?.code === CLOCK_SKEW_ERROR_CODE;
    attempt++
  ) {
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    result = await run()
  }

  return result
}
