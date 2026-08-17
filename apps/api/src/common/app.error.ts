export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = this.constructor.name
    Error.captureStackTrace?.(this, this.constructor)
  }
}
