import dotenv from "dotenv";
import { z } from "zod";

dotenv.config()

const envSchema = z.object({
  VITE_PORT: z.coerce.number().min(1024).max(65535),
  VITE_API_URL: z.string(),
  VITE_WS_URL: z.string(),
  VITE_DEBUG: z.coerce.boolean().default(false),
  VITE_APP_NAME: z.string().min(1).default("Mediasoup Conference"),
})

const _env = envSchema.safeParse(process.env)
if (!_env.success) {
  console.error("❌ Invalid environment variables:", _env.error.format())
  process.exit(1);
}

export const env = _env.data;
