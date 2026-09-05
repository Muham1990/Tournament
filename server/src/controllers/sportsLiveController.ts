import type { Request, Response, NextFunction } from "express";
import { getSportsSchedule } from "../services/sportsSchedule.js";

export async function sportsLive(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getSportsSchedule();
    res.json(data);
  } catch (e) {
    next(e);
  }
}
