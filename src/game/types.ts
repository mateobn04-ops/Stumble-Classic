export type SkinId =
  | 'sr_stumble'
  | 'rojinegro_r'
  | 'gorra_bw'
  | 'dj_neon'
  | 'samurai_jade'
  | 'unicornio'
  | 'pirata_esqueleto'
  | 'astronauta'
  | 'valkiria'
  | 'anubis'
  | 'leon_dorado'
  | 'robot_mk1'
  | 'fantasma'
  | 'alien_morado'
  | 'kunoichi'
  // Stumble Guys 0.56 additions
  | 'mr_stumble_oro'
  | 'bananaman'
  | 'hot_dog'
  | 'pollo_loco'
  | 'tiburon'
  | 'dragon_infernal'
  | 'ciber_ninja'
  | 'barbie_glam'
  | 'piloto_turbo'
  | 'titan_bestia'
  | 'caballero_oscuro'
  | 'capitan_galaxia'
  | 'esqueleto_neon'
  | 'pinguino_rey'
  | 'mago_arcano';

export type AccessoryType =
  | 'cap_og'
  | 'crest_r'
  | 'cap_bw'
  | 'dj_hoodie'
  | 'samurai_kabuto'
  | 'unicorn_horn'
  | 'pirate_hat'
  | 'astro_helmet'
  | 'valkyrie_wings'
  | 'anubis_ears'
  | 'lion_mane'
  | 'robot_antenna'
  | 'ghost_sheet'
  | 'alien_head'
  | 'ninja_topknot'
  | 'gold_crown'
  | 'banana_suit'
  | 'hotdog_suit'
  | 'chicken_head'
  | 'shark_fin'
  | 'dragon_wings'
  | 'cyber_visor'
  | 'glam_glasses'
  | 'turbo_helmet'
  | 'beast_crown'
  | 'knight_helm'
  | 'cosmic_halo'
  | 'neon_skull'
  | 'penguin_beak'
  | 'wizard_hat';

export type RarityType =
  | 'Común'
  | 'Raro'
  | 'Épico'
  | 'Legendario'
  | 'Mítico'
  | 'Especial';

export interface SkinConfig {
  id: SkinId;
  name: string;
  rarity: RarityType;
  bodyColor: number;
  pantsColor: number;
  accentColor: number;
  shoeColor: number;
  skinTone: number;
  accessory: AccessoryType;
  pattern?: 'stripes' | 'ribs' | 'mech' | 'rojinegro' | 'none';
  priceGems: number;
  priceTokens?: number;
  previewBg: string;
  badgeImage?: string;
}

export type EmoteId =
  // Expression Emotes
  | 'saludo'
  | 'risa'
  | 'enojado'
  | 'lloro'
  | 'corazon'
  | 'fuego'
  | 'corona_emote'
  | 'gg'
  | 'calavera'
  | 'trofeo_emote'
  // Special Action Emotes (0.56)
  | 'punetazo'
  | 'patada'
  | 'abrazo'
  | 'platano'
  | 'balon'
  | 'rayo_espada'
  | 'invisibilidad'
  | 'escudo';

export interface EmoteConfig {
  id: EmoteId;
  name: string;
  icon: string;
  category: 'expresion' | 'especial';
  rarity: RarityType;
  description: string;
  cooldownSec: number;
  priceGems: number;
  priceTokens?: number;
  bubbleColor: string;
}

export type FootstepId =
  | 'normal'
  | 'fuego'
  | 'arcoiris'
  | 'estrellas'
  | 'hielo'
  | 'rayos';

export interface FootstepConfig {
  id: FootstepId;
  name: string;
  rarity: RarityType;
  colors: number[];
  previewColor: string;
  priceGems: number;
}

export type VictoryAnimId =
  | 'baile_clasico'
  | 'salto_campeon'
  | 'giro_epico'
  | 'pose_rey';

export interface VictoryAnimConfig {
  id: VictoryAnimId;
  name: string;
  rarity: RarityType;
  description: string;
  priceGems: number;
}

export type MapId =
  | 'circuito_caos'
  | 'cima_helada'
  | 'hexagonos'
  | 'block_dash'
  | 'laser_tracer'
  | 'lava_land'
  | 'super_slide'
  | 'cannon_climb';

export type GameMode = 'tournament' | 'party' | MapId;

export type PartyType = 'normal' | 'custom';
export type PartyEmoteRule = 'all' | 'none' | 'custom';

export interface PartyMember {
  id: string;
  name: string;
  skinId: SkinId;
  isHost: boolean;
  isFriend: boolean;
  ready: boolean;
}

export interface PartyConfig {
  active: boolean;
  roomCode: string;
  partyType: PartyType;
  maxPlayers: number;
  roundCount: 1 | 2 | 3;
  selectedMaps: [MapId, MapId, MapId];
  emoteRule: PartyEmoteRule;
  allowedEmotes: EmoteId[];
  members: PartyMember[];
}

export type GamePhase =
  | 'lobby'
  | 'intro'
  | 'countdown'
  | 'playing'
  | 'round_over'
  | 'eliminated'
  | 'victory';

export interface MapMetadata {
  id: MapId;
  name: string;
  subtitle: string;
  type: 'race' | 'survival';
  defaultQualify: number;
  accentHex: string;
}

export type WBadgeColor = 'blue' | 'red' | 'rainbow';

export interface TournamentStage {
  index: number;
  name: string;
  shortName: string;
  totalPlayers: number;
  qualifyCount: number;
  isFinal: boolean;
}

export interface TournamentRewardSummary {
  gems: number;
  tokens: number;
  unlockedSkinName?: string;
  unlockedSkinRarity?: RarityType;
  wBadgeUnlockedNow?: boolean;
}

export interface HudState {
  phase: GamePhase;
  roundNumber: number;
  totalRounds: number;
  isTournament: boolean;
  stageName: string;
  stages: TournamentStage[];
  mapMeta: MapMetadata;
  qualifyCount: number;
  qualifyTarget: number;
  aliveCount: number;
  totalContestants: number;
  countdownText: string;
  elapsedTime: number;
  playerQualified: boolean;
  playerEliminated: boolean;
  playerRank: number | null;
  winnerName: string;
  feedText: string;
  emotesEnabled: boolean;
  emoteSlots: EmoteConfig[];
  emoteCooldowns: Record<string, number>;
  shieldActive: boolean;
  invisActive: boolean;
  partyBadge: string | null;
  tournamentReward?: TournamentRewardSummary | null;
}

export type MissionMetric =
  | 'matches_played'
  | 'rounds_qualified'
  | 'jumps_made'
  | 'dives_made'
  | 'crowns_won';

export interface DailyMission {
  id: string;
  title: string;
  description: string;
  metric: MissionMetric;
  target: number;
  rewardGems: number;
  rewardTokens: number;
}

export interface PlayerStats {
  playerName: string;
  level: number;
  xp: number;
  passTier: number;
  passXp: number;
  gems: number;
  tokens: number;
  crowns: number;
  trophies: number;
  wins: number;
  tournamentWins: number;
  wBadgeColor: WBadgeColor;
  matches: number;
  selectedSkin: SkinId;
  unlockedSkins: SkinId[];
  equippedEmotes: [EmoteId, EmoteId, EmoteId, EmoteId];
  unlockedEmotes: EmoteId[];
  selectedFootstep: FootstepId;
  unlockedFootsteps: FootstepId[];
  selectedVictoryAnim: VictoryAnimId;
  unlockedVictoryAnims: VictoryAnimId[];
  claimedPassTiers: number[];
  lastFreeSpinAt: number;
  dailyDate: string;
  dailyProgress: Record<MissionMetric, number>;
  claimedMissions: string[];
}
