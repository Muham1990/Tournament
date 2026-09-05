import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import * as t from "../controllers/tournamentController.js";
import * as p from "../controllers/participantController.js";
import * as d from "../controllers/drawFightController.js";
import * as m from "../controllers/miscController.js";
import * as sl from "../controllers/sportsLiveController.js";
import * as ai from "../controllers/aiController.js";
import { uploadMemory, uploadAudio } from "../middleware/upload.js";

export const apiRouter = Router();

apiRouter.get("/tournaments", t.listTournaments);
apiRouter.get("/tournaments/:id", t.getTournament);
apiRouter.post("/tournaments", requireAdmin, upload.single("image"), t.createTournament);
apiRouter.put("/tournaments/:id", requireAdmin, upload.single("image"), t.updateTournament);
apiRouter.delete("/tournaments/:id", requireAdmin, t.deleteTournament);
apiRouter.post("/tournaments/:id/status", requireAdmin, t.setStatus);
apiRouter.post("/tournaments/:id/close-registration", requireAdmin, t.closeRegistration);
apiRouter.post("/tournaments/:id/start", requireAdmin, t.startTournament);
apiRouter.post("/tournaments/:id/finish", requireAdmin, t.finishTournament);
apiRouter.get("/dashboard", requireAdmin, t.dashboard);

apiRouter.get("/tournaments/:id/participants", p.listParticipants);
apiRouter.post("/tournaments/:id/participants", requireAdmin, upload.single("photo"), p.createParticipant);
apiRouter.get("/participants/:id", p.getParticipant);
apiRouter.put("/participants/:id", requireAdmin, upload.single("photo"), p.updateParticipant);
apiRouter.delete("/participants/:id", requireAdmin, p.deleteParticipant);

apiRouter.get("/tournaments/:id/categories", d.listCategories);
apiRouter.post("/tournaments/:id/categories", requireAdmin, d.createCategory);
apiRouter.put("/categories/:id", requireAdmin, d.updateCategory);
apiRouter.delete("/categories/:id", requireAdmin, d.deleteCategory);

apiRouter.post("/tournaments/:id/draw/generate", requireAdmin, d.generateDraw);
apiRouter.get("/tournaments/:id/draws", d.getDraws);
apiRouter.get("/tournaments/:id/draws/:drawId", d.getDraw);

apiRouter.get("/tournaments/:id/fights", d.listFights);
apiRouter.get("/fights/:id", d.getFight);
apiRouter.post("/fights/:id/start", requireAdmin, d.startFightCtrl);
apiRouter.post("/fights/:id/result", requireAdmin, d.fightResultCtrl);
apiRouter.post("/fights/:id/special", requireAdmin, d.fightSpecialCtrl);
apiRouter.put("/fights/:id", requireAdmin, d.updateFight);

apiRouter.get("/tournaments/:id/results", d.listResults);
apiRouter.post("/categories/:categoryId/confirm-results", requireAdmin, d.confirmResults);

apiRouter.get("/clubs", m.listClubs);
apiRouter.post("/clubs", requireAdmin, upload.single("logo"), m.createClub);
apiRouter.put("/clubs/:id", requireAdmin, upload.single("logo"), m.updateClub);
apiRouter.delete("/clubs/:id", requireAdmin, m.deleteClub);

apiRouter.get("/countries", m.listCountries);
apiRouter.post("/countries", requireAdmin, m.createCountry);
apiRouter.put("/countries/:id", requireAdmin, m.updateCountry);

apiRouter.get("/tournaments/:id/tatami", m.listTatami);
apiRouter.post("/tournaments/:id/tatami", requireAdmin, m.createTatami);
apiRouter.put("/tatami/:id", requireAdmin, m.updateTatami);
apiRouter.delete("/tatami/:id", requireAdmin, m.deleteTatami);

apiRouter.get("/tournaments/:id/live", m.liveBoard);

apiRouter.get("/tournaments/:id/officials", m.listOfficials);
apiRouter.post("/tournaments/:id/officials", requireAdmin, upload.single("photo"), m.createOfficial);
apiRouter.delete("/officials/:id", requireAdmin, m.deleteOfficial);

apiRouter.get("/tournaments/:id/videos", m.listVideos);
apiRouter.post("/tournaments/:id/videos", requireAdmin, m.createVideo);
apiRouter.delete("/videos/:id", requireAdmin, m.deleteVideo);

apiRouter.get("/tournaments/:id/schedule", m.listSchedule);
apiRouter.post("/tournaments/:id/schedule", requireAdmin, m.createSchedule);
apiRouter.post("/tournaments/:id/schedule/auto", requireAdmin, m.autoSchedule);

apiRouter.post("/messages", m.createMessage);
apiRouter.get("/messages", requireAdmin, m.listMessages);
apiRouter.post("/messages/:id/read", requireAdmin, m.markMessage);

apiRouter.get("/settings", m.getSettings);
apiRouter.put("/settings", requireAdmin, upload.single("logo"), m.updateSettings);

apiRouter.get("/sports-live", sl.sportsLive);
apiRouter.get("/pricing", m.listPricing);
apiRouter.put("/pricing/:id", requireAdmin, m.updatePricing);

apiRouter.get("/audit", requireAdmin, m.listAudit);
apiRouter.get("/tournaments/:id/statistics", m.statistics);

apiRouter.get("/ai/providers", requireAdmin, ai.listAiProviders);
apiRouter.post("/ai/scan", requireAdmin, uploadMemory.single("photo"), ai.scanParticipants);
apiRouter.post("/ai/voice", requireAdmin, uploadAudio.single("audio"), ai.parseVoice);
apiRouter.post("/ai/commit", requireAdmin, ai.commitAiParticipant);
apiRouter.post("/ai/assistant", requireAdmin, uploadAudio.single("audio"), ai.assistantChat);
apiRouter.post("/ai/voice-tournament", requireAdmin, uploadAudio.single("audio"), ai.parseTournamentVoice);

apiRouter.get("/tournaments/:id/export/participants", requireAdmin, m.exportParticipants);
apiRouter.get("/tournaments/:id/export/results", requireAdmin, m.exportResults);
apiRouter.get("/tournaments/:id/export/pdf", requireAdmin, m.exportPdf);
