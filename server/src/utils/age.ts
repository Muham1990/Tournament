export function ageOnDate(birthDate: Date, onDate: Date): number {
  let age = onDate.getFullYear() - birthDate.getFullYear();
  const m = onDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && onDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

export function rankIndex(rank: string | null | undefined): number | null {
  if (!rank) return null;
  const n = rank.trim().toUpperCase();
  const kyu = n.match(/^(\d+)\s*KYU$/);
  if (kyu) return 10 - Number(kyu[1]);
  const dan = n.match(/^(\d+)\s*DAN$/);
  if (dan) return 10 + Number(dan[1]);
  return null;
}

export const RANKS = [
  "10 KYU", "9 KYU", "8 KYU", "7 KYU", "6 KYU", "5 KYU", "4 KYU", "3 KYU", "2 KYU", "1 KYU",
  "1 DAN", "2 DAN", "3 DAN", "4 DAN", "5 DAN", "6 DAN", "7 DAN", "8 DAN", "9 DAN", "10 DAN",
];
