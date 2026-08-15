import { PostHog } from "posthog-node"

export function createPostHogServerClient(): PostHog | null {
  if (process.env.VITEST) return null

  const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!projectToken || !host) return null

  return new PostHog(projectToken, {
    host,
    // Route handlers are short-lived, so flush every call instead of batching.
    flushAt: 1,
    flushInterval: 0,
  })
}

async function withPostHogClient(
  run: (client: PostHog) => void
): Promise<void> {
  const client = createPostHogServerClient()
  if (!client) return

  try {
    run(client)
    await client.shutdown()
  } catch {
    // Observability must never break the caller's request flow.
  }
}

export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  return withPostHogClient((client) => {
    client.capture({ distinctId, event, properties })
  })
}

export function captureServerException(
  error: unknown,
  distinctId: string,
  properties?: Record<string, unknown>
): Promise<void> {
  return withPostHogClient((client) => {
    client.captureException(error, distinctId, properties)
  })
}
