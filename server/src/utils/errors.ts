export class AppError extends Error {
  status: number;
  code: string;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function errorHandler(
  err: unknown,
  _req: import("express").Request,
  res: import("express").Response,
  _next: import("express").NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const anyErr = err as { status?: number; message?: string; name?: string; issues?: Array<{ message: string }> };
  if (anyErr?.name === "ZodError") {
    const msg = anyErr.issues?.[0]?.message || "Проверьте обязательные поля";
    res.status(400).json({ error: msg, code: "VALIDATION" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error", code: "INTERNAL" });
}
