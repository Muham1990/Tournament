export type Gender = "BOYS" | "GIRLS" | "MEN" | "WOMEN" | "MIXED";
export type TournamentStatus = "DRAFT" | "REGISTRATION" | "READY" | "LIVE" | "FINISHED" | "ARCHIVED";
export type Discipline = "KUMITE" | "KATA" | "TEAM_KATA" | "TEAM_KUMITE";
export type FightStatus = "WAITING" | "READY" | "LIVE" | "FINISHED" | "BYE" | "CANCELLED";
export type DrawMode = "RANDOM" | "SEEDED" | "CLUB_SEPARATION" | "COUNTRY_SEPARATION";

export interface Country {
  id: string;
  name: string;
  nameRu: string;
  nameTg: string;
  code: string;
  flag: string;
}

export interface Club {
  id: string;
  name: string;
  countryId?: string | null;
  country?: Country | null;
  city?: string | null;
  logoUrl?: string | null;
  coach?: string | null;
  phone?: string | null;
  email?: string | null;
  _count?: { participants: number };
}

export interface Category {
  id: string;
  tournamentId: string;
  name: string;
  discipline: Discipline;
  gender: Gender;
  minAge?: number | null;
  maxAge?: number | null;
  minWeight?: number | null;
  maxWeight?: number | null;
  rankMin?: string | null;
  rankMax?: string | null;
  status: string;
  bronzeMode: "ONE" | "TWO";
  thirdPlace: boolean;
  _count?: { participants: number; fights: number };
}

export interface Participant {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  age?: number;
  gender: Gender;
  countryId?: string | null;
  country?: Country | null;
  city?: string | null;
  photoUrl?: string | null;
  clubId?: string | null;
  club?: Club | null;
  school?: string | null;
  weight?: number | null;
  entryFee?: number | null;
  rank?: string | null;
  belt?: string | null;
  coach?: string | null;
  phone?: string | null;
  email?: string | null;
  categoryId?: string | null;
  category?: Category | null;
}

export interface Tournament {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  dateStart: string;
  dateEnd: string;
  timeStart?: string | null;
  timeEnd?: string | null;
  countryId?: string | null;
  country?: Country | null;
  city?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  organizer?: string | null;
  email?: string | null;
  phone?: string | null;
  venue?: string | null;
  rules?: string | null;
  regulations?: string | null;
  registrationInfo?: string | null;
  status: TournamentStatus;
  tatamiCount: number;
  _count?: { participants: number; categories: number; fights: number };
}

export interface Fight {
  id: string;
  round: number;
  roundName: string;
  fightNumber: number;
  isThirdPlace: boolean;
  participantAId?: string | null;
  participantBId?: string | null;
  participantA?: Participant | null;
  participantB?: Participant | null;
  winnerId?: string | null;
  loserId?: string | null;
  winner?: Participant | null;
  loser?: Participant | null;
  nextFightId?: string | null;
  nextSlot?: "A" | "B" | null;
  slotABye: boolean;
  slotBBye: boolean;
  tatamiId?: string | null;
  tatami?: { id: string; name: string; number: number } | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  scoreA?: number | null;
  scoreB?: number | null;
  status: FightStatus;
  winMethod?: string | null;
  category?: Category | null;
  categoryId: string;
  tournamentId: string;
  bracketId?: string | null;
}

export interface Bracket {
  id: string;
  size: number;
  mode: DrawMode;
  status: string;
  thirdPlace: boolean;
  bronzeMode: string;
  category: Category;
  fights: Fight[];
}

export interface ResultRow {
  id: string;
  place: number;
  medal?: "GOLD" | "SILVER" | "BRONZE" | null;
  official: boolean;
  participant: Participant;
  category: Category;
}

export interface SiteSettings {
  id: string;
  siteName: string;
  tagline: string;
  logoUrl?: string | null;
  email: string;
  phone: string;
  location: string;
}

export interface User {
  id: string;
  email: string;
  role: "ADMIN";
  name?: string | null;
}
