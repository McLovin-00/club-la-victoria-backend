export class CustomError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    // Captura la traza de la pila para facilitar el debugging
    Error.captureStackTrace(this, this.constructor);
  }
}
