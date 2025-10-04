export class BotError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const isBotError = (error: unknown): error is BotError => error instanceof BotError
