import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().min(1000),
  ENVIRONMENT: z
    .union([
      z.literal("development"),
      z.literal("testing"),
      z.literal("production"),
    ])
    .default("development"),
  CORS_ORIGIN: z.coerce.string()
});

const env = envSchema.parse(process.env)

export default env