import { z } from "zod"

const requiredString = (name: string) =>
  z.string().trim().min(1, `${name} is required`)

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: requiredString("NEXT_PUBLIC_SUPABASE_URL").url(
    "NEXT_PUBLIC_SUPABASE_URL must be a valid URL"
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredString(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ),
  SUPABASE_SERVICE_ROLE_KEY: requiredString("SUPABASE_SERVICE_ROLE_KEY"),
  ANTHROPIC_API_KEY: requiredString("ANTHROPIC_API_KEY"),
  POLAR_ACCESS_TOKEN: requiredString("POLAR_ACCESS_TOKEN"),
  POLAR_WEBHOOK_SECRET: requiredString("POLAR_WEBHOOK_SECRET"),
  POLAR_PRO_PRODUCT_ID: requiredString("POLAR_PRO_PRODUCT_ID"),
  POLAR_SERVER: z.enum(["sandbox", "production"], {
    error: "POLAR_SERVER must be sandbox or production",
  }),
  SUCCESS_URL: requiredString("SUCCESS_URL").url(
    "SUCCESS_URL must be a valid URL"
  ),
})

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  POLAR_ACCESS_TOKEN: process.env.POLAR_ACCESS_TOKEN,
  POLAR_WEBHOOK_SECRET: process.env.POLAR_WEBHOOK_SECRET,
  POLAR_PRO_PRODUCT_ID: process.env.POLAR_PRO_PRODUCT_ID,
  POLAR_SERVER: process.env.POLAR_SERVER,
  SUCCESS_URL: process.env.SUCCESS_URL,
})
