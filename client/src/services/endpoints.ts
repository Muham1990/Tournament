import { api } from "./api";
import type {
  Bracket,
  Category,
  Club,
  Country,
  Fight,
  Participant,
  ResultRow,
  SiteSettings,
  Tournament,
  User,
} from "../types";

export const AuthApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: User }>("/auth/login", {
      email,
      password,
      gate: sessionStorage.getItem("ka_gate") || undefined,
    }),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<{ user: User }>("/auth/me"),
  openGate: (code: string) => api.get<{ ok: boolean }>(`/auth/gate/${encodeURIComponent(code)}`),
  invite: () => api.get<{ path: string }>("/auth/invite"),
};

export const TournamentApi = {
  list: (params?: Record<string, string>) =>
    api.get<{ items: Tournament[] }>("/tournaments", { params }),
  get: (id: string) => api.get<{ item: Tournament }>(`/tournaments/${id}`),
  create: (fd: FormData) => api.post<{ item: Tournament }>("/tournaments", fd),
  update: (id: string, fd: FormData) => api.put<{ item: Tournament }>(`/tournaments/${id}`, fd),
  remove: (id: string) => api.delete(`/tournaments/${id}`),
  start: (id: string) => api.post(`/tournaments/${id}/start`),
  finish: (id: string) => api.post(`/tournaments/${id}/finish`),
  closeReg: (id: string) => api.post(`/tournaments/${id}/close-registration`),
  status: (id: string, status: string) => api.post(`/tournaments/${id}/status`, { status }),
};

export type AiProviderName = "gemini" | "groq" | "openrouter";

export type AiAthleteResult = {
  created: boolean;
  firstName: string | null;
  lastName: string | null;
  age: number | null;
  weight: number | null;
  country: string | null;
  countryId: string | null;
  category: string | null;
  missing: string[];
  warnings: string[];
  ask?: string | null;
  askField?: string | null;
  duplicate?: boolean;
  existing?: string | null;
  transcript?: string;
  used?: string;
  participant?: { id: string; photoUrl?: string | null };
};

export const AiApi = {
  providers: () => api.get<{ providers: { gemini: boolean; groq: boolean; openrouter: boolean } }>("/ai/providers"),
  scan: (fd: FormData) => api.post<{ found: number; used?: string; results: AiAthleteResult[] }>("/ai/scan", fd),
  voice: (body: FormData | Record<string, unknown>) => api.post<AiAthleteResult>("/ai/voice", body),
  commit: (body: Record<string, unknown>) => api.post<AiAthleteResult>("/ai/commit", body),
  assistant: (body: FormData | Record<string, unknown>) =>
    api.post<{ reply: string; heard?: string; used?: string }>("/ai/assistant", body),
  voiceTournament: (body: FormData | Record<string, unknown>) =>
    api.post<AiTournamentDraft>("/ai/voice-tournament", body),
};

export type AiTournamentDraft = {
  title: string | null;
  slug: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  timeStart: string | null;
  timeEnd: string | null;
  city: string | null;
  address: string | null;
  organizer: string | null;
  email: string | null;
  phone: string | null;
  venue: string | null;
  tatamiCount: string | null;
  description: string | null;
  country: string | null;
  transcript?: string;
};

export const ParticipantApi = {
  list: (tid: string, params?: Record<string, string | number>) =>
    api.get<{ items: Participant[]; total: number; clubs: Club[]; page: number; pageSize: number }>(
      `/tournaments/${tid}/participants`,
      { params },
    ),
  create: (tid: string, fd: FormData) => api.post(`/tournaments/${tid}/participants`, fd),
  update: (id: string, fd: FormData) => api.put(`/participants/${id}`, fd),
  remove: (id: string) => api.delete(`/participants/${id}`),
  removeAll: (tid: string) => api.delete(`/tournaments/${tid}/participants`),
  get: (id: string) => api.get<{ item: Participant }>(`/participants/${id}`),
};

export const CategoryApi = {
  list: (tid: string) => api.get<{ items: Category[] }>(`/tournaments/${tid}/categories`),
  create: (tid: string, data: unknown) => api.post(`/tournaments/${tid}/categories`, data),
  update: (id: string, data: unknown) => api.put(`/categories/${id}`, data),
  remove: (id: string) => api.delete(`/categories/${id}`),
  confirmResults: (id: string) => api.post(`/categories/${id}/confirm-results`),
};

export const DrawApi = {
  generate: (tid: string, data: { categoryId: string; mode: string; force?: boolean }) =>
    api.post<{ item: Bracket }>(`/tournaments/${tid}/draw/generate`, data),
  list: (tid: string) => api.get<{ items: Bracket[] }>(`/tournaments/${tid}/draws`),
  get: (tid: string, drawId: string) => api.get<{ item: Bracket }>(`/tournaments/${tid}/draws/${drawId}`),
};

export const FightApi = {
  list: (tid: string, params?: Record<string, string>) =>
    api.get<{ items: Fight[] }>(`/tournaments/${tid}/fights`, { params }),
  get: (id: string) => api.get<{ item: Fight }>(`/fights/${id}`),
  start: (id: string) => api.post<{ item: Fight }>(`/fights/${id}/start`),
  result: (id: string, data: unknown) => api.post<{ item: Fight }>(`/fights/${id}/result`, data),
  special: (id: string, data: unknown) => api.post<{ item: Fight }>(`/fights/${id}/special`, data),
  update: (id: string, data: unknown) => api.put<{ item: Fight }>(`/fights/${id}`, data),
};

export const ResultsApi = {
  list: (tid: string) => api.get<{ items: ResultRow[] }>(`/tournaments/${tid}/results`),
};

export const ClubApi = {
  list: () => api.get<{ items: Club[] }>("/clubs"),
  create: (fd: FormData) => api.post("/clubs", fd),
  update: (id: string, fd: FormData) => api.put(`/clubs/${id}`, fd),
  remove: (id: string) => api.delete(`/clubs/${id}`),
};

export const CountryApi = {
  list: () => api.get<{ items: Country[] }>("/countries"),
  create: (data: unknown) => api.post("/countries", data),
  update: (id: string, data: unknown) => api.put(`/countries/${id}`, data),
};

export const MiscApi = {
  settings: () => api.get<{ item: SiteSettings }>("/settings"),
  updateSettings: (fd: FormData) => api.put("/settings", fd),
  pricing: () => api.get("/pricing"),
  updatePricing: (id: string, data: unknown) => api.put(`/pricing/${id}`, data),
  dashboard: () => api.get("/dashboard"),
  live: (tid: string) => api.get(`/tournaments/${tid}/live`),
  officials: (tid: string) => api.get(`/tournaments/${tid}/officials`),
  createOfficial: (tid: string, fd: FormData) => api.post(`/tournaments/${tid}/officials`, fd),
  deleteOfficial: (id: string) => api.delete(`/officials/${id}`),
  videos: (tid: string) => api.get(`/tournaments/${tid}/videos`),
  createVideo: (tid: string, data: unknown) => api.post(`/tournaments/${tid}/videos`, data),
  deleteVideo: (id: string) => api.delete(`/videos/${id}`),
  schedule: (tid: string) => api.get(`/tournaments/${tid}/schedule`),
  createSchedule: (tid: string, data: unknown) => api.post(`/tournaments/${tid}/schedule`, data),
  autoSchedule: (tid: string) => api.post(`/tournaments/${tid}/schedule/auto`),
  tatami: (tid: string) => api.get(`/tournaments/${tid}/tatami`),
  createTatami: (tid: string, data: unknown) => api.post(`/tournaments/${tid}/tatami`, data),
  updateTatami: (id: string, data: unknown) => api.put(`/tatami/${id}`, data),
  deleteTatami: (id: string) => api.delete(`/tatami/${id}`),
  messages: () => api.get("/messages"),
  sendMessage: (data: unknown) => api.post("/messages", data),
  readMessage: (id: string) => api.post(`/messages/${id}/read`),
  audit: (page = 1) => api.get("/audit", { params: { page } }),
  stats: (tid: string) => api.get(`/tournaments/${tid}/statistics`),
  sportsLive: () => api.get("/sports-live"),
};
