import { DailyMission, MissionMetric } from './types';

export function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createEmptyDailyProgress(): Record<MissionMetric, number> {
  return {
    matches_played: 0,
    rounds_qualified: 0,
    jumps_made: 0,
    dives_made: 0,
    crowns_won: 0,
  };
}

const MISSION_POOL: DailyMission[] = [
  {
    id: 'm_play_3',
    title: 'Calentamiento Clásico',
    description: 'Juega 3 partidas en cualquier modo.',
    metric: 'matches_played',
    target: 3,
    rewardGems: 35,
    rewardTokens: 10,
  },
  {
    id: 'm_qualify_4',
    title: 'Velocista Imparable',
    description: 'Clasifica en 4 rondas de carrera.',
    metric: 'rounds_qualified',
    target: 4,
    rewardGems: 45,
    rewardTokens: 15,
  },
  {
    id: 'm_jumps_25',
    title: 'Saltarín Profesional',
    description: 'Realiza 25 saltos durante tus partidas.',
    metric: 'jumps_made',
    target: 25,
    rewardGems: 30,
    rewardTokens: 10,
  },
  {
    id: 'm_dives_10',
    title: 'Maestro de la Plancha',
    description: 'Ejecuta 10 planchas en el aire.',
    metric: 'dives_made',
    target: 10,
    rewardGems: 40,
    rewardTokens: 12,
  },
  {
    id: 'm_crown_1',
    title: 'Rey de la Corona',
    description: 'Gana 1 Corona en Torneo o Hexágonos.',
    metric: 'crowns_won',
    target: 1,
    rewardGems: 80,
    rewardTokens: 25,
  },
  {
    id: 'm_play_5',
    title: 'Maratón Stumble',
    description: 'Juega 5 partidas hoy.',
    metric: 'matches_played',
    target: 5,
    rewardGems: 55,
    rewardTokens: 18,
  },
];

export function getDailyMissions(dateKey: string): DailyMission[] {
  // Deterministic daily rotation based on dateKey so missions stay consistent all day
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const rotated = [...MISSION_POOL];
  for (let i = rotated.length - 1; i > 0; i--) {
    const j = (hash + i * 7) % (i + 1);
    const tmp = rotated[i];
    rotated[i] = rotated[j];
    rotated[j] = tmp;
  }
  return rotated.slice(0, 4);
}
