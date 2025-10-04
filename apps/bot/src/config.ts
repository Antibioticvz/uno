import 'dotenv/config'

import { z } from 'zod'

const schema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN обязателен'),
  WEB_APP_URL: z.string().optional(),
})

export type AppConfig = z.infer<typeof schema>

export const loadConfig = (): AppConfig => schema.parse(process.env)
