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
  const prismaCode = (err as { code?: string; errorCode?: string }).code
    || (err as { errorCode?: string }).errorCode;
  const prismaName = (err as { name?: string }).name || "";
  if ((typeof prismaCode === "string" && prismaCode.startsWith("P")) || prismaName.includes("Prisma")) {
    console.error(err);
    const connect = prismaCode === "P1001" || prismaCode === "P1017" || prismaCode === "P1000";
    const missing = prismaCode === "P2021" || prismaCode === "P2022";
    const error = connect
      ? "Нет связи с Neon. В DATABASE_URL уберите channel_binding=require и нажмите Resume в Neon."
      : missing
        ? "База ещё готовит таблицы. Подождите 20 секунд и нажмите Сохранить снова."
        : "База данных недоступна. Проверьте DATABASE_URL на Railway и что Neon не на паузе.";
    res.status(503).json({ error, code: "DB", prisma: prismaCode || prismaName });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error", code: "INTERNAL" });
}
