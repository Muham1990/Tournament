import { Router } from "express";
import { inviteLink, login, logout, me, openGate } from "../controllers/authController.js";
import { requireAdmin } from "../middleware/auth.js";

export const authRouter = Router();
authRouter.get("/gate/:code", openGate);
authRouter.post("/gate", openGate);
authRouter.get("/invite", requireAdmin, inviteLink);
authRouter.post("/login", login);
authRouter.post("/logout", logout);
authRouter.get("/me", requireAdmin, me);
