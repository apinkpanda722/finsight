import { Polar } from "@polar-sh/sdk"

import { getServerEnv } from "@/lib/env"

export function createPolarClient() {
  const env = getServerEnv()

  return new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
    server: env.POLAR_SERVER,
  })
}
