import React, { useState } from 'react';
import {
  Check,
  ClipboardList,
  Copy,
  Crown,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Lock,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  ShoppingBag,
  Smile,
  Sparkles,
  Star,
  Ticket,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ALL_MAP_IDS,
  BOT_NAMES,
  CLASSIC_SKINS,
  EMOTES_CATALOG,
  FOOTSTEPS_CATALOG,
  GAME_VERSION,
  MAPS_META,
  TOURNAMENT_STAGES,
  VICTORY_ANIMS_CATALOG,
} from '../game/skins';
import { soundManager } from '../game/audio';
import {
  DailyMission,
  EmoteConfig,
  EmoteId,
  FootstepConfig,
  FootstepId,
  GameMode,
  MapId,
  PartyConfig,
  PartyEmoteRule,
  PartyMember,
  PlayerStats,
  RarityType,
  SkinConfig,
  SkinId,
  VictoryAnimConfig,
  VictoryAnimId,
  WBadgeColor,
} from '../game/types';
import { WBadge, WColorSelector } from './WBadge';

interface LobbyOverlayProps {
  stats: PlayerStats;
  dailyMissions: DailyMission[];
  selectedMode: GameMode;
  partyConfig: PartyConfig;
  muted: boolean;
  onSelectMode: (mode: GameMode) => void;
  onUpdateParty: (party: PartyConfig) => void;
  onPlayParty: (party: PartyConfig) => void;
  onSelectSkin: (skinId: SkinId) => void;
  onUnlockSkin: (skin: SkinConfig, currency: 'gems' | 'tokens') => void;
  onEquipEmote: (slotIndex: number, emoteId: EmoteId) => void;
  onUnlockEmote: (emote: EmoteConfig, currency: 'gems' | 'tokens') => void;
  onSelectFootstep: (footstepId: FootstepId) => void;
  onUnlockFootstep: (footstep: FootstepConfig) => void;
  onSelectVictoryAnim: (animId: VictoryAnimId) => void;
  onUnlockVictoryAnim: (anim: VictoryAnimConfig) => void;
  onClaimFreePrize: (reward: { type: 'gems' | 'tokens' | 'skin'; amount: number; skinId?: SkinId }) => void;
  onClaimPassTier: (tier: number, rewardType: 'gems' | 'tokens' | 'skin', amount: number, skinId?: SkinId) => void;
  onClaimMission: (mission: DailyMission) => void;
  onAddCurrencyPack: (gems: number, tokens: number) => void;
  onChangeName: (name: string) => void;
  onChangeWColor: (color: WBadgeColor) => void;
  onToggleMute: () => void;
  onPlay: () => void;
}

type ActiveModal =
  | null
  | 'shop'
  | 'customize'
  | 'ranking'
  | 'prizes'
  | 'tournaments'
  | 'party'
  | 'pass'
  | 'missions'
  | 'news'
  | 'settings';

type CustomizeTab = 'skins' | 'emotes' | 'footsteps' | 'victories';

const PASS_TIERS: Array<{
  tier: number;
  label: string;
  rewardType: 'gems' | 'tokens' | 'skin';
  amount: number;
  skinId?: SkinId;
}> = [
  { tier: 1, label: '35 Gemas', rewardType: 'gems', amount: 35 },
  { tier: 2, label: '20 Fichas', rewardType: 'tokens', amount: 20 },
  { tier: 3, label: 'Skin Hombre Plátano', rewardType: 'skin', amount: 1, skinId: 'bananaman' },
  { tier: 4, label: '75 Gemas', rewardType: 'gems', amount: 75 },
  { tier: 5, label: 'Skin Sr. Stumble Oro', rewardType: 'skin', amount: 1, skinId: 'mr_stumble_oro' },
  { tier: 6, label: 'Skin Dragón Infernal', rewardType: 'skin', amount: 1, skinId: 'dragon_infernal' },
];

const RARITY_BADGE_CLASSES: Record<RarityType, string> = {
  Común: 'bg-slate-600 text-slate-100',
  Raro: 'bg-sky-500 text-white',
  Épico: 'bg-purple-600 text-white',
  Legendario: 'bg-amber-400 text-slate-950',
  Mítico: 'bg-rose-600 text-white',
  Especial: 'bg-cyan-400 text-slate-950',
};

function makeRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SG-${out}`;
}

export const LobbyOverlay: React.FC<LobbyOverlayProps> = ({
  stats,
  dailyMissions,
  selectedMode,
  partyConfig,
  muted,
  onSelectMode,
  onUpdateParty,
  onPlayParty,
  onSelectSkin,
  onUnlockSkin,
  onEquipEmote,
  onUnlockEmote,
  onSelectFootstep,
  onUnlockFootstep,
  onSelectVictoryAnim,
  onUnlockVictoryAnim,
  onClaimFreePrize,
  onClaimPassTier,
  onClaimMission,
  onAddCurrencyPack,
  onChangeName,
  onChangeWColor,
  onToggleMute,
  onPlay,
}) => {
  const [modal, setModal] = useState<ActiveModal>(null);
  const [customizeTab, setCustomizeTab] = useState<CustomizeTab>('skins');
  const [activeEmoteSlot, setActiveEmoteSlot] = useState<number>(0);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(stats.playerName);
  const [newsUnread, setNewsUnread] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [joinCodeDraft, setJoinCodeDraft] = useState('');

  const [sfxOn, setSfxOn] = useState(() => soundManager.isSfxEnabled());
  const [musicOn, setMusicOn] = useState(() => soundManager.isMusicEnabled());

  const canFreeSpin = Date.now() - stats.lastFreeSpinAt > 60_000;
  const claimableMissionsCount = dailyMissions.filter(
    (m) =>
      !stats.claimedMissions.includes(m.id) &&
      (stats.dailyProgress[m.metric] || 0) >= m.target,
  ).length;
  const claimedMissionsCount = dailyMissions.filter((m) =>
    stats.claimedMissions.includes(m.id),
  ).length;

  const openModal = (next: ActiveModal) => {
    soundManager.playButtonClick();
    setModal(next);
  };

  const commitName = () => {
    const clean = draftName.trim().slice(0, 14) || 'Jugador';
    setDraftName(clean);
    onChangeName(clean);
    setEditingName(false);
  };

  const handleSpinWheel = () => {
    if (spinning || !canFreeSpin) return;
    setSpinning(true);
    setSpinResult(null);

    const tickInterval = window.setInterval(() => {
      soundManager.playSpinTick();
    }, 95);

    window.setTimeout(() => {
      clearInterval(tickInterval);
      const lockedSkins = CLASSIC_SKINS.filter(
        (s) => !stats.unlockedSkins.includes(s.id),
      );
      const roll = Math.random();
      if (roll < 0.38 && lockedSkins.length > 0) {
        const wonSkin = lockedSkins[Math.floor(Math.random() * lockedSkins.length)];
        onClaimFreePrize({ type: 'skin', amount: 1, skinId: wonSkin.id });
        setSpinResult(`¡Desbloqueaste la skin ${wonSkin.name}!`);
      } else if (roll < 0.72) {
        onClaimFreePrize({ type: 'gems', amount: 60 });
        setSpinResult('¡Ganaste +60 Gemas!');
      } else {
        onClaimFreePrize({ type: 'tokens', amount: 20 });
        setSpinResult('¡Ganaste +20 Fichas Stumble!');
      }
      setSpinning(false);
    }, 900);
  };

  const modeLabel =
    selectedMode === 'tournament'
      ? 'Torneo 0.56 (6 Fases)'
      : selectedMode === 'party'
        ? partyConfig.partyType === 'normal'
          ? `Grupo Normal · ${partyConfig.roomCode}`
          : `Grupo Personalizado · ${partyConfig.roundCount}R`
        : MAPS_META[selectedMode].name;

  const cycleWColor = () => {
    const order: WBadgeColor[] = ['blue', 'red', 'rainbow'];
    const idx = order.indexOf(stats.wBadgeColor);
    onChangeWColor(order[(idx + 1) % order.length]);
  };

  // Party Helpers
  const addFriendToParty = () => {
    if (partyConfig.members.length >= 8) return;
    soundManager.playButtonClick();
    const usedNames = new Set(partyConfig.members.map((m) => m.name));
    const availableName =
      BOT_NAMES.find((n) => !usedNames.has(n)) || `Amigo_${partyConfig.members.length + 1}`;
    const randomSkin =
      CLASSIC_SKINS[Math.floor(Math.random() * CLASSIC_SKINS.length)].id;
    const friend: PartyMember = {
      id: `friend_${Date.now()}_${Math.random()}`,
      name: availableName,
      skinId: randomSkin,
      isHost: false,
      isFriend: true,
      ready: true,
    };
    onUpdateParty({
      ...partyConfig,
      members: [...partyConfig.members, friend],
    });
  };

  const removePartyMember = (id: string) => {
    soundManager.playButtonClick();
    onUpdateParty({
      ...partyConfig,
      members: partyConfig.members.filter((m) => m.id !== id),
    });
  };

  const toggleAllowedEmote = (emoteId: EmoteId) => {
    soundManager.playButtonClick();
    const exists = partyConfig.allowedEmotes.includes(emoteId);
    const next = exists
      ? partyConfig.allowedEmotes.filter((id) => id !== emoteId)
      : [...partyConfig.allowedEmotes, emoteId];
    onUpdateParty({ ...partyConfig, allowedEmotes: next });
  };

  const setEmoteRule = (rule: PartyEmoteRule) => {
    soundManager.playButtonClick();
    onUpdateParty({
      ...partyConfig,
      emoteRule: rule,
      allowedEmotes:
        rule === 'all'
          ? EMOTES_CATALOG.map((e) => e.id)
          : rule === 'none'
            ? []
            : partyConfig.allowedEmotes,
    });
  };

  const updateMapSlot = (roundIdx: 0 | 1 | 2, mapId: MapId) => {
    soundManager.playButtonClick();
    const nextMaps: [MapId, MapId, MapId] = [...partyConfig.selectedMaps] as [
      MapId,
      MapId,
      MapId,
    ];
    nextMaps[roundIdx] = mapId;
    onUpdateParty({ ...partyConfig, selectedMaps: nextMaps });
  };

  const handleCopyCode = () => {
    soundManager.playButtonClick();
    navigator.clipboard?.writeText(partyConfig.roomCode).catch(() => {});
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1400);
  };

  const handleApplyJoinCode = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = joinCodeDraft.trim().toUpperCase().slice(0, 8);
    if (!clean) return;
    soundManager.playButtonClick();
    onUpdateParty({ ...partyConfig, roomCode: clean });
    setJoinCodeDraft('');
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between">
      {/* =====================================================================
          TOP HEADER BAR (Exact classic Stumble Guys style + 0.56 badge)
      ===================================================================== */}
      <header className="pointer-events-auto flex items-center justify-between gap-2 bg-[#0b4ca0] px-3 py-2 border-b-4 border-[#062f68] shadow-lg">
        {/* Left Cluster: Level Badge + Name/Trophies/Crowns + News */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center gap-2.5 rounded-xl bg-[#1164cb] px-2.5 py-1.5 border-2 border-[#083879] shadow-inner">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-400 border-2 border-slate-900 shadow font-display text-xl font-extrabold text-white"
              style={{ textShadow: '0 2px 0 #0f172a' }}
              title={`Nivel ${stats.level}`}
            >
              {stats.level}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {editingName ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitName();
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      autoFocus
                      type="text"
                      maxLength={14}
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={commitName}
                      className="w-28 sm:w-36 rounded bg-slate-950/90 px-2 py-0.5 text-sm font-extrabold text-white border border-amber-400 focus:outline-none"
                    />
                  </form>
                ) : (
                  <>
                    {stats.tournamentWins > 0 && (
                      <button
                        type="button"
                        onClick={cycleWColor}
                        title="Cambiar color de W (Azul / Rojo / Arcoíris)"
                        className="cursor-pointer transition-transform hover:scale-110"
                      >
                        <WBadge color={stats.wBadgeColor} size="sm" />
                      </button>
                    )}
                    <span
                      className="truncate max-w-[130px] sm:max-w-[180px] font-display text-sm sm:text-base font-extrabold tracking-wide text-white"
                      style={{ textShadow: '0 2px 0 #062f68' }}
                    >
                      {stats.playerName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftName(stats.playerName);
                        setEditingName(true);
                      }}
                      aria-label="Editar nombre"
                      className="rounded p-1 text-sky-200 hover:bg-white/15 hover:text-white cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              <div className="mt-0.5 flex items-center gap-2">
                <div className="flex items-center gap-1 rounded bg-[#072f69] px-2 py-0.5 text-xs font-extrabold text-white">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <span className="font-mono-num">{stats.trophies}</span>
                </div>
                <div className="flex items-center gap-1 rounded bg-[#072f69] px-2 py-0.5 text-xs font-extrabold text-white">
                  <Crown className="h-3.5 w-3.5 text-amber-300" />
                  <span className="font-mono-num">{stats.crowns}</span>
                </div>
                <span className="hidden sm:inline-block rounded bg-amber-400 px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold text-slate-950">
                  v{GAME_VERSION}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewsUnread(false);
              openModal('news');
            }}
            aria-label="Novedades"
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-white text-slate-800 border-2 border-slate-900 border-b-4 shadow cursor-pointer"
          >
            <Newspaper className="h-5 w-5" />
            {newsUnread && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-extrabold text-white border-2 border-white">
                1
              </span>
            )}
          </button>
        </div>

        {/* Right Cluster: Fichas (S) + Gemas + Ajustes */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-1.5 rounded-xl bg-[#072f69] pl-1.5 pr-1 py-1 border-2 border-[#051f47]">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-fuchsia-500 border-2 border-fuchsia-200 font-display text-sm font-extrabold text-white shadow">
              S
            </div>
            <span className="min-w-[26px] text-center font-mono-num text-sm font-extrabold text-white">
              {stats.tokens}
            </span>
            <button
              type="button"
              onClick={() => openModal('shop')}
              aria-label="Conseguir fichas"
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-900 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl bg-[#072f69] pl-1.5 pr-1 py-1 border-2 border-[#051f47]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20">
              <Gem className="h-5 w-5 text-emerald-400 fill-emerald-400" />
            </div>
            <span className="min-w-[26px] text-center font-mono-num text-sm font-extrabold text-white">
              {stats.gems}
            </span>
            <button
              type="button"
              onClick={() => openModal('shop')}
              aria-label="Conseguir gemas"
              className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white border border-emerald-900 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => openModal('settings')}
            aria-label="Ajustes"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1164cb] hover:bg-[#1a74e2] text-white border-2 border-[#062f68] cursor-pointer"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* =====================================================================
          MIDDLE ROW: Left & Right Classic Arcade Icon Stacks
      ===================================================================== */}
      <div className="flex flex-1 items-start justify-between px-3 sm:px-5 pt-4">
        {/* Left Vertical Menu + Permanent Champion W Screen Badge */}
        <div className="pointer-events-auto flex flex-col gap-3">
          {stats.tournamentWins > 0 && (
            <div className="flex flex-col items-start gap-1.5 rounded-2xl bg-[#072f69]/95 p-2.5 border-2 border-amber-300/75 shadow-xl">
              <div className="flex items-center gap-2">
                <WBadge color={stats.wBadgeColor} size="md" />
                <div className="leading-tight">
                  <div className="font-display text-xs font-extrabold text-amber-300">
                    CAMPEÓN ({stats.tournamentWins})
                  </div>
                  <div className="truncate max-w-[110px] font-display text-[11px] font-bold text-white">
                    {stats.playerName}
                  </div>
                </div>
              </div>
              <WColorSelector
                value={stats.wBadgeColor}
                onChange={onChangeWColor}
                compact
              />
            </div>
          )}
          <MenuTile
            label="TIENDA"
            bgClass="bg-amber-400 hover:bg-amber-300 border-amber-700"
            icon={<ShoppingBag className="h-8 w-8 text-rose-600" />}
            onClick={() => setModal('shop')}
          />
          <MenuTile
            label="PERSONALIZAR"
            bgClass="bg-sky-500 hover:bg-sky-400 border-sky-800"
            icon={<Smile className="h-8 w-8 text-white" />}
            onClick={() => setModal('customize')}
          />
          <MenuTile
            label="RANKING"
            bgClass="bg-sky-500 hover:bg-sky-400 border-sky-800"
            icon={<Trophy className="h-8 w-8 text-amber-300" />}
            onClick={() => setModal('ranking')}
          />
        </div>

        {/* Right Vertical Menu */}
        <div className="pointer-events-auto flex flex-col gap-3">
          <MenuTile
            label="PREMIOS"
            badge={canFreeSpin ? '1' : undefined}
            bgClass="bg-indigo-700 hover:bg-indigo-600 border-indigo-950"
            icon={<Gift className="h-8 w-8 text-amber-300" />}
            onClick={() => setModal('prizes')}
          />
          <MenuTile
            label="TORNEOS"
            bgClass="bg-sky-500 hover:bg-sky-400 border-sky-800"
            icon={<Crown className="h-8 w-8 text-amber-300 fill-amber-300" />}
            onClick={() => setModal('tournaments')}
          />
          <MenuTile
            label="GRUPO"
            badge={
              partyConfig.members.length > 1
                ? String(partyConfig.members.length)
                : undefined
            }
            bgClass="bg-sky-500 hover:bg-sky-400 border-sky-800"
            icon={<Users className="h-8 w-8 text-white" />}
            onClick={() => setModal('party')}
          />
        </div>
      </div>

      {/* =====================================================================
          BOTTOM ROW: Stumble Pass + Misiones (Left) + Play CTA (Right)
      ===================================================================== */}
      <footer className="pointer-events-auto flex items-end justify-between gap-3 px-3 sm:px-5 pb-4">
        <div className="flex flex-wrap items-end gap-2.5">
          <button
            type="button"
            onClick={() => openModal('pass')}
            className="arcade-btn group relative flex flex-col items-start rounded-2xl bg-[#0e57b5] hover:bg-[#1465cc] px-4 py-2.5 text-white border-2 border-[#062f68] border-b-4 shadow-xl cursor-pointer min-w-[195px] sm:min-w-[230px]"
          >
            <div className="flex w-full items-center justify-between gap-3">
              <span
                className="font-display text-sm sm:text-base font-extrabold tracking-wide text-white whitespace-nowrap"
                style={{ textShadow: '0 2px 0 #062f68' }}
              >
                STUMBLE PASS
              </span>
              <span className="flex items-center gap-1 rounded-lg bg-amber-400 px-2 py-0.5 font-display text-xs font-extrabold text-slate-950 border border-amber-700 -rotate-3 shadow shrink-0">
                <Ticket className="h-3.5 w-3.5" />
                0.56
              </span>
            </div>

            <div className="mt-1.5 flex w-full items-center gap-2">
              <Star className="h-5 w-5 shrink-0 text-amber-300 fill-amber-300" />
              <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-slate-950/80 border border-slate-900">
                <div
                  className="h-full bg-sky-400 transition-all"
                  style={{ width: `${Math.min(100, (stats.passXp / 50) * 100)}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[11px] font-extrabold text-white">
                  {stats.passXp}/50
                </span>
              </div>
              <span className="font-display text-lg font-extrabold text-white">
                {stats.passTier}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => openModal('missions')}
            className="arcade-btn relative flex items-center gap-2.5 rounded-2xl bg-[#0e57b5] hover:bg-[#1465cc] px-3.5 sm:px-4 py-2.5 text-white border-2 border-[#062f68] border-b-4 shadow-xl cursor-pointer shrink-0"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 border-2 border-emerald-800 shadow">
              <ClipboardList className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span
                className="font-display text-sm sm:text-base font-extrabold tracking-wide text-white whitespace-nowrap"
                style={{ textShadow: '0 2px 0 #062f68' }}
              >
                MISIONES
              </span>
              <span className="font-mono-num text-[11px] font-bold text-sky-200 whitespace-nowrap">
                {claimedMissionsCount}/{dailyMissions.length} hoy
              </span>
            </div>
            {claimableMissionsCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-rose-600 px-1.5 font-mono-num text-xs font-extrabold text-white border-2 border-white shadow">
                {claimableMissionsCount}
              </span>
            )}
          </button>
        </div>

        {/* Bottom-Right Mode Tag + Iconic Golden PLAY Button */}
        <div className="flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={() => openModal(selectedMode === 'party' ? 'party' : 'tournaments')}
            className="rounded-lg bg-slate-950/75 hover:bg-slate-950 px-3 py-1 text-xs font-bold text-sky-200 border border-white/15 cursor-pointer"
          >
            Modo: <span className="text-amber-300">{modeLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playButtonClick();
              onPlay();
            }}
            className="arcade-btn rounded-2xl bg-amber-400 hover:bg-amber-300 px-10 sm:px-14 py-3.5 sm:py-4 font-display text-2xl sm:text-3xl font-extrabold tracking-wider text-white border-2 border-amber-800 border-b-[6px] shadow-2xl cursor-pointer"
            style={{ textShadow: '0 3px 0 #b45309' }}
          >
            ¡JUGAR!
          </button>
        </div>
      </footer>

      {/* =====================================================================
          INTERACTIVE MODALS
      ===================================================================== */}
      {modal && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-3 sm:p-4">
          <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-[#0e57b5] text-white border-4 border-[#062f68] shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-[#083b7f] px-5 py-3.5 border-b-2 border-[#062f68]">
              <h2 className="font-display text-lg sm:text-2xl font-extrabold text-amber-300">
                {modal === 'customize' && `PERSONALIZAR · VERSIÓN ${GAME_VERSION}`}
                {modal === 'shop' && `TIENDA STUMBLE ${GAME_VERSION}`}
                {modal === 'prizes' && 'RULETA DE PREMIOS GRATIS'}
                {modal === 'ranking' && 'CLASIFICACIÓN'}
                {modal === 'tournaments' && 'TORNEOS Y MAPAS (0.56)'}
                {modal === 'party' && 'GRUPO · PARTIDA CON AMIGOS'}
                {modal === 'pass' && 'STUMBLE PASS 0.56'}
                {modal === 'missions' && 'MISIONES DIARIAS'}
                {modal === 'news' && `NOVEDADES STUMBLE ${GAME_VERSION}`}
                {modal === 'settings' && 'AJUSTES Y CONTROLES'}
              </h2>
              <button
                type="button"
                onClick={() => setModal(null)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-400 text-white border-2 border-rose-900 cursor-pointer"
              >
                <X className="h-5 w-5 stroke-[3]" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-4 sm:p-5">
              {/* ===============================================================
                  CUSTOMIZE 0.56 (4 TABS: Skins, Emotes, Footsteps, Victory Anims)
              =============================================================== */}
              {modal === 'customize' && (
                <div className="space-y-4">
                  {/* 4 Customize Tabs */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      {
                        id: 'skins' as const,
                        label: `Skins (${stats.unlockedSkins.length}/${CLASSIC_SKINS.length})`,
                        icon: <Users className="h-4 w-4" />,
                      },
                      {
                        id: 'emotes' as const,
                        label: `Emotes (${stats.unlockedEmotes.length}/${EMOTES_CATALOG.length})`,
                        icon: <Smile className="h-4 w-4" />,
                      },
                      {
                        id: 'footsteps' as const,
                        label: `Huellas (${stats.unlockedFootsteps.length}/${FOOTSTEPS_CATALOG.length})`,
                        icon: <Footprints className="h-4 w-4" />,
                      },
                      {
                        id: 'victories' as const,
                        label: `Animaciones (${stats.unlockedVictoryAnims.length}/${VICTORY_ANIMS_CATALOG.length})`,
                        icon: <Sparkles className="h-4 w-4" />,
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          soundManager.playButtonClick();
                          setCustomizeTab(tab.id);
                        }}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 font-display text-xs sm:text-sm font-extrabold border-2 cursor-pointer whitespace-nowrap ${
                          customizeTab === tab.id
                            ? 'bg-amber-400 text-slate-950 border-amber-700'
                            : 'bg-[#083b7f] text-sky-100 border-[#052654] hover:bg-[#0d4899]'
                        }`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* TAB 1: 30 SKINS */}
                  {customizeTab === 'skins' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                      {CLASSIC_SKINS.map((skin) => {
                        const unlocked = stats.unlockedSkins.includes(skin.id);
                        const equipped = stats.selectedSkin === skin.id;
                        const hex = '#' + skin.bodyColor.toString(16).padStart(6, '0');
                        const accent = '#' + skin.accentColor.toString(16).padStart(6, '0');
                        return (
                          <div
                            key={skin.id}
                            className={`flex flex-col justify-between rounded-2xl p-2.5 border-2 ${
                              equipped
                                ? 'bg-amber-400/20 border-amber-300'
                                : 'bg-[#083b7f] border-[#052654]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold">
                              <span
                                className={`rounded px-1.5 py-0.5 ${RARITY_BADGE_CLASSES[skin.rarity]}`}
                              >
                                {skin.rarity}
                              </span>
                              {equipped && <Check className="h-4 w-4 text-amber-300 shrink-0" />}
                            </div>

                            <div className="my-2.5 flex flex-col items-center">
                              <div
                                className="flex h-13 w-13 items-center justify-center rounded-2xl border-2 border-white/80 shadow-md overflow-hidden p-1"
                                style={{ backgroundColor: skin.previewBg }}
                              >
                                {skin.badgeImage ? (
                                  <img
                                    src={skin.badgeImage}
                                    alt={skin.name}
                                    className="h-10 w-10 object-contain drop-shadow"
                                  />
                                ) : (
                                  <div
                                    className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center"
                                    style={{ backgroundColor: hex }}
                                  >
                                    <span
                                      className="h-3 w-3 rounded-full"
                                      style={{ backgroundColor: accent }}
                                    />
                                  </div>
                                )}
                              </div>
                              <span className="mt-1.5 text-center font-display text-xs font-extrabold text-white leading-tight">
                                {skin.name}
                              </span>
                            </div>

                            {unlocked ? (
                              <button
                                type="button"
                                onClick={() => onSelectSkin(skin.id)}
                                className={`w-full rounded-xl py-1.5 text-xs font-extrabold cursor-pointer ${
                                  equipped
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-sky-500 hover:bg-sky-400 text-white'
                                }`}
                              >
                                {equipped ? 'Equipada' : 'Equipar'}
                              </button>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled={stats.gems < skin.priceGems}
                                  onClick={() => onUnlockSkin(skin, 'gems')}
                                  className={`flex w-full items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-extrabold ${
                                    stats.gems >= skin.priceGems
                                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  <Lock className="h-3 w-3" />
                                  <span>{skin.priceGems} G</span>
                                </button>
                                {skin.priceTokens && (
                                  <button
                                    type="button"
                                    disabled={stats.tokens < skin.priceTokens}
                                    onClick={() => onUnlockSkin(skin, 'tokens')}
                                    className={`flex w-full items-center justify-center gap-1 rounded-xl py-1 text-[11px] font-extrabold ${
                                      stats.tokens >= skin.priceTokens
                                        ? 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white cursor-pointer'
                                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                    }`}
                                  >
                                    <span>{skin.priceTokens} S</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB 2: 18 EMOTES + 4-SLOT ACTION DECK */}
                  {customizeTab === 'emotes' && (
                    <div className="space-y-4">
                      {/* 4-Slot Equipped Emote Deck */}
                      <div className="rounded-2xl bg-[#083b7f] p-3.5 border-2 border-[#052654]">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                          <span className="font-display text-sm font-extrabold text-amber-300">
                            Mazo Activo en Partida (Teclas 1, 2, 3, 4)
                          </span>
                          <span className="text-xs text-sky-200">
                            Toca una ranura y elige un emote debajo
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {stats.equippedEmotes.map((eId, idx) => {
                            const em =
                              EMOTES_CATALOG.find((x) => x.id === eId) || EMOTES_CATALOG[0];
                            const selected = activeEmoteSlot === idx;
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setActiveEmoteSlot(idx)}
                                className={`flex items-center gap-2.5 rounded-xl p-2.5 border-2 text-left cursor-pointer ${
                                  selected
                                    ? 'bg-amber-400/25 border-amber-300'
                                    : 'bg-[#0b4ca0] border-white/15 hover:bg-[#115fc4]'
                                }`}
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-950 font-mono-num text-xs font-extrabold text-amber-300">
                                  {idx + 1}
                                </span>
                                <span className="text-2xl leading-none">{em.icon}</span>
                                <div className="min-w-0">
                                  <div className="truncate font-display text-xs font-extrabold text-white">
                                    {em.name}
                                  </div>
                                  <div className="text-[10px] text-sky-200">
                                    {em.category === 'especial' ? 'Especial' : 'Expresión'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Full 18 Emotes Catalog */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {EMOTES_CATALOG.map((em) => {
                          const unlocked = stats.unlockedEmotes.includes(em.id);
                          const slotIdx = stats.equippedEmotes.indexOf(em.id);
                          return (
                            <div
                              key={em.id}
                              className={`flex flex-col justify-between rounded-2xl p-3 border-2 ${
                                slotIdx !== -1
                                  ? 'bg-amber-400/15 border-amber-300'
                                  : 'bg-[#083b7f] border-[#052654]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl border-2 border-white/70 shadow"
                                    style={{ backgroundColor: em.bubbleColor }}
                                  >
                                    {em.icon}
                                  </div>
                                  <div>
                                    <div className="font-display text-sm font-extrabold text-white">
                                      {em.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                                          em.category === 'especial'
                                            ? 'bg-rose-500 text-white'
                                            : 'bg-sky-600 text-white'
                                        }`}
                                      >
                                        {em.category === 'especial' ? 'ESPECIAL 0.56' : 'EXPRESIÓN'}
                                      </span>
                                      <span className="font-mono-num text-[10px] text-sky-200">
                                        {em.cooldownSec}s
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                {slotIdx !== -1 && (
                                  <span className="rounded-md bg-amber-400 px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold text-slate-950">
                                    #{slotIdx + 1}
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-[11px] text-sky-100 leading-snug">
                                {em.description}
                              </p>

                              <div className="mt-2.5">
                                {unlocked ? (
                                  <button
                                    type="button"
                                    onClick={() => onEquipEmote(activeEmoteSlot, em.id)}
                                    className={`w-full rounded-xl py-1.5 text-xs font-extrabold cursor-pointer ${
                                      slotIdx === activeEmoteSlot
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-sky-500 hover:bg-sky-400 text-white'
                                    }`}
                                  >
                                    {slotIdx === activeEmoteSlot
                                      ? `Equipado en Ranura ${activeEmoteSlot + 1}`
                                      : `Equipar en Ranura ${activeEmoteSlot + 1}`}
                                  </button>
                                ) : (
                                  <div className="flex gap-1.5">
                                    <button
                                      type="button"
                                      disabled={stats.gems < em.priceGems}
                                      onClick={() => onUnlockEmote(em, 'gems')}
                                      className={`flex-1 rounded-xl py-1.5 text-xs font-extrabold ${
                                        stats.gems >= em.priceGems
                                          ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                      }`}
                                    >
                                      {em.priceGems} G
                                    </button>
                                    {em.priceTokens && (
                                      <button
                                        type="button"
                                        disabled={stats.tokens < em.priceTokens}
                                        onClick={() => onUnlockEmote(em, 'tokens')}
                                        className={`flex-1 rounded-xl py-1.5 text-xs font-extrabold ${
                                          stats.tokens >= em.priceTokens
                                            ? 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white cursor-pointer'
                                            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                        }`}
                                      >
                                        {em.priceTokens} S
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: 6 FOOTSTEPS (HUELLAS) */}
                  {customizeTab === 'footsteps' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {FOOTSTEPS_CATALOG.map((fs) => {
                        const unlocked = stats.unlockedFootsteps.includes(fs.id);
                        const equipped = stats.selectedFootstep === fs.id;
                        return (
                          <div
                            key={fs.id}
                            className={`flex flex-col justify-between rounded-2xl p-4 border-2 ${
                              equipped
                                ? 'bg-amber-400/20 border-amber-300'
                                : 'bg-[#083b7f] border-[#052654]'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${RARITY_BADGE_CLASSES[fs.rarity]}`}
                                >
                                  {fs.rarity}
                                </span>
                                {equipped && <Check className="h-4 w-4 text-amber-300" />}
                              </div>
                              <div className="mt-3 flex items-center gap-2">
                                {fs.colors.map((c, i) => (
                                  <span
                                    key={i}
                                    className="h-6 w-6 rounded-full border-2 border-white shadow"
                                    style={{
                                      backgroundColor: '#' + c.toString(16).padStart(6, '0'),
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="mt-2.5 font-display text-base font-extrabold text-white">
                                {fs.name}
                              </div>
                            </div>

                            <div className="mt-3">
                              {unlocked ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectFootstep(fs.id)}
                                  className={`w-full rounded-xl py-2 text-xs font-extrabold cursor-pointer ${
                                    equipped
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-sky-500 hover:bg-sky-400 text-white'
                                  }`}
                                >
                                  {equipped ? 'Equipada' : 'Equipar'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={stats.gems < fs.priceGems}
                                  onClick={() => onUnlockFootstep(fs)}
                                  className={`w-full rounded-xl py-2 text-xs font-extrabold ${
                                    stats.gems >= fs.priceGems
                                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  Desbloquear ({fs.priceGems} G)
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB 4: 4 VICTORY ANIMATIONS */}
                  {customizeTab === 'victories' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {VICTORY_ANIMS_CATALOG.map((va) => {
                        const unlocked = stats.unlockedVictoryAnims.includes(va.id);
                        const equipped = stats.selectedVictoryAnim === va.id;
                        return (
                          <div
                            key={va.id}
                            className={`flex flex-col justify-between rounded-2xl p-4 border-2 ${
                              equipped
                                ? 'bg-amber-400/20 border-amber-300'
                                : 'bg-[#083b7f] border-[#052654]'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-extrabold ${RARITY_BADGE_CLASSES[va.rarity]}`}
                                >
                                  {va.rarity}
                                </span>
                                {equipped && <Check className="h-4 w-4 text-amber-300" />}
                              </div>
                              <div className="mt-2 font-display text-base font-extrabold text-white">
                                {va.name}
                              </div>
                              <p className="mt-1 text-xs text-sky-200">{va.description}</p>
                            </div>

                            <div className="mt-3">
                              {unlocked ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectVictoryAnim(va.id)}
                                  className={`w-full rounded-xl py-2 text-xs font-extrabold cursor-pointer ${
                                    equipped
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-sky-500 hover:bg-sky-400 text-white'
                                  }`}
                                >
                                  {equipped ? 'Equipada (Vista en Lobby)' : 'Equipar y Probar'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={stats.gems < va.priceGems}
                                  onClick={() => onUnlockVictoryAnim(va)}
                                  className={`w-full rounded-xl py-2 text-xs font-extrabold ${
                                    stats.gems >= va.priceGems
                                      ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer'
                                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  Desbloquear ({va.priceGems} G)
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ===============================================================
                  GRUPO MODAL (PARTIDA NORMAL vs PARTIDA PERSONALIZADA)
              =============================================================== */}
              {modal === 'party' && (
                <div className="space-y-4">
                  {/* Top Bar: Room Code + Normal vs Custom Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#083b7f] p-4 border-2 border-[#052654]">
                    <div>
                      <div className="text-xs font-bold text-sky-200">CÓDIGO DE SALA</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="font-mono-num text-2xl font-extrabold tracking-wider text-amber-300">
                          {partyConfig.roomCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="flex items-center gap-1 rounded-lg bg-[#0b4ca0] hover:bg-[#1164cb] px-2.5 py-1 text-xs font-bold text-white border border-white/15 cursor-pointer"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span>{codeCopied ? 'Copiado' : 'Copiar'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            soundManager.playButtonClick();
                            onUpdateParty({ ...partyConfig, roomCode: makeRandomCode() });
                          }}
                          aria-label="Nuevo código"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0b4ca0] hover:bg-[#1164cb] text-sky-100 border border-white/15 cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleApplyJoinCode} className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="Unirse (ej. SG-ABCD)"
                        maxLength={8}
                        value={joinCodeDraft}
                        onChange={(e) => setJoinCodeDraft(e.target.value)}
                        className="w-40 rounded-xl bg-slate-950/85 px-3 py-2 font-mono-num text-xs font-bold text-white border border-white/20 focus:border-amber-400 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-sky-500 hover:bg-sky-400 px-3 py-2 text-xs font-extrabold text-white cursor-pointer"
                      >
                        Entrar
                      </button>
                    </form>
                  </div>

                  {/* Party Type Tabs: Normal vs Personalizada */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        onUpdateParty({ ...partyConfig, partyType: 'normal' });
                      }}
                      className={`flex items-start gap-3 rounded-2xl p-4 text-left border-2 cursor-pointer ${
                        partyConfig.partyType === 'normal'
                          ? 'bg-amber-400/20 border-amber-300'
                          : 'bg-[#083b7f] border-white/10 hover:bg-[#0d4899]'
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow">
                        <Gamepad2 className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-display text-base font-extrabold text-amber-300">
                          Partida Normal
                        </div>
                        <p className="mt-0.5 text-xs text-sky-100">
                          Entra con tus amigos al instante: 3 mapas aleatorios, todos los emotes activos y solo aprietas el botón amarillo.
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        onUpdateParty({ ...partyConfig, partyType: 'custom' });
                      }}
                      className={`flex items-start gap-3 rounded-2xl p-4 text-left border-2 cursor-pointer ${
                        partyConfig.partyType === 'custom'
                          ? 'bg-amber-400/20 border-amber-300'
                          : 'bg-[#083b7f] border-white/10 hover:bg-[#0d4899]'
                      }`}
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500 text-white shadow">
                        <Settings className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="font-display text-base font-extrabold text-white">
                          Partida Personalizada
                        </div>
                        <p className="mt-0.5 text-xs text-sky-100">
                          Elige exactamente qué mapas jugar, cuántas rondas, número de jugadores y qué emotes permitir o desactivar.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* Friends / Squad List */}
                  <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="font-display text-sm font-extrabold text-white">
                        Jugadores en tu Grupo ({partyConfig.members.length}/8)
                      </div>
                      <button
                        type="button"
                        onClick={addFriendToParty}
                        disabled={partyConfig.members.length >= 8}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-extrabold ${
                          partyConfig.members.length < 8
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer'
                            : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Invitar Amigo</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {partyConfig.members.map((m) => {
                        const skin =
                          CLASSIC_SKINS.find((s) => s.id === m.skinId) || CLASSIC_SKINS[0];
                        return (
                          <div
                            key={m.id}
                            className="flex items-center gap-2 rounded-xl bg-[#0b4ca0] px-3 py-1.5 border border-white/15"
                          >
                            <span
                              className="h-4 w-4 rounded-full border border-white"
                              style={{
                                backgroundColor:
                                  '#' + skin.bodyColor.toString(16).padStart(6, '0'),
                              }}
                            />
                            <span className="flex items-center gap-1.5 font-display text-xs font-extrabold text-white">
                              {m.isHost && stats.tournamentWins > 0 && (
                                <WBadge color={stats.wBadgeColor} size="xs" />
                              )}
                              <span>
                                {m.name} {m.isHost ? '(Líder)' : ''}
                              </span>
                            </span>
                            {!m.isHost && (
                              <button
                                type="button"
                                onClick={() => removePartyMember(m.id)}
                                aria-label="Quitar amigo"
                                className="text-rose-300 hover:text-rose-200 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* NORMAL PARTY SUMMARY */}
                  {partyConfig.partyType === 'normal' && (
                    <div className="rounded-2xl bg-[#083b7f] p-4 border border-emerald-400/35 text-sm text-sky-100">
                      <div className="font-display text-base font-extrabold text-emerald-300">
                        Configuración Lista · Partida Normal
                      </div>
                      <ul className="mt-1.5 space-y-1 text-xs">
                        <li>· 3 Rondas automáticas entre los 8 mapas de Stumble Guys 0.56</li>
                        <li>· Todos los 18 emotes habilitados (expresión y especiales)</li>
                        <li>· Sala de 32 jugadores con tus amigos del grupo</li>
                      </ul>
                    </div>
                  )}

                  {/* CUSTOM PARTY CONTROLS */}
                  {partyConfig.partyType === 'custom' && (
                    <div className="space-y-4">
                      {/* Rounds & Max Players */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                          <div className="font-display text-sm font-extrabold text-white mb-2">
                            Número de Rondas
                          </div>
                          <div className="flex gap-2">
                            {([1, 2, 3] as const).map((rc) => (
                              <button
                                key={rc}
                                type="button"
                                onClick={() => {
                                  soundManager.playButtonClick();
                                  onUpdateParty({ ...partyConfig, roundCount: rc });
                                }}
                                className={`flex-1 rounded-xl py-2 font-mono-num text-sm font-extrabold border-2 cursor-pointer ${
                                  partyConfig.roundCount === rc
                                    ? 'bg-amber-400 text-slate-950 border-amber-700'
                                    : 'bg-[#0b4ca0] text-white border-white/15 hover:bg-[#1164cb]'
                                }`}
                              >
                                {rc} {rc === 1 ? 'Ronda' : 'Rondas'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-display text-sm font-extrabold text-white">
                              Jugadores Máximos
                            </span>
                            <span className="font-mono-num text-sm font-extrabold text-amber-300">
                              {partyConfig.maxPlayers} jugadores
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {[4, 8, 16, 24, 32].map((cap) => (
                              <button
                                key={cap}
                                type="button"
                                onClick={() => {
                                  soundManager.playButtonClick();
                                  onUpdateParty({ ...partyConfig, maxPlayers: cap });
                                }}
                                className={`flex-1 rounded-xl py-2 font-mono-num text-xs font-extrabold border-2 cursor-pointer ${
                                  partyConfig.maxPlayers === cap
                                    ? 'bg-amber-400 text-slate-950 border-amber-700'
                                    : 'bg-[#0b4ca0] text-white border-white/15 hover:bg-[#1164cb]'
                                }`}
                              >
                                {cap}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Map Selection per Round */}
                      <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15 space-y-3">
                        <div className="font-display text-sm font-extrabold text-amber-300">
                          Elegir Mapas por Ronda (Todos los mapas 0.56)
                        </div>
                        {Array.from({ length: partyConfig.roundCount }).map((_, idx) => {
                          const rIdx = idx as 0 | 1 | 2;
                          const chosenMap = partyConfig.selectedMaps[rIdx];
                          return (
                            <div key={rIdx} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-bold text-sky-200">
                                <span>Ronda {rIdx + 1}</span>
                                <span className="text-white">{MAPS_META[chosenMap].name}</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                {ALL_MAP_IDS.map((mId) => {
                                  const meta = MAPS_META[mId];
                                  const active = chosenMap === mId;
                                  return (
                                    <button
                                      key={mId}
                                      type="button"
                                      onClick={() => updateMapSlot(rIdx, mId)}
                                      className={`rounded-xl px-2.5 py-2 text-left border-2 cursor-pointer ${
                                        active
                                          ? 'bg-amber-400 text-slate-950 border-amber-700'
                                          : 'bg-[#0b4ca0] text-white border-white/10 hover:bg-[#1164cb]'
                                      }`}
                                    >
                                      <div className="truncate font-display text-xs font-extrabold">
                                        {meta.name}
                                      </div>
                                      <div
                                        className={`text-[10px] font-bold ${
                                          active ? 'text-slate-800' : 'text-sky-200'
                                        }`}
                                      >
                                        {meta.type === 'survival' ? 'Supervivencia' : 'Carrera'}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Emotes Rules */}
                      <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15 space-y-3">
                        <div className="font-display text-sm font-extrabold text-amber-300">
                          Reglas de Emotes en la Sala
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setEmoteRule('all')}
                            className={`rounded-xl p-2.5 text-left border-2 cursor-pointer ${
                              partyConfig.emoteRule === 'all'
                                ? 'bg-emerald-500/25 border-emerald-400'
                                : 'bg-[#0b4ca0] border-white/10 hover:bg-[#1164cb]'
                            }`}
                          >
                            <div className="font-display text-xs font-extrabold text-white">
                              Todos los Emotes
                            </div>
                            <div className="text-[11px] text-sky-200">
                              Todos los 18 emotes activos
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEmoteRule('none')}
                            className={`rounded-xl p-2.5 text-left border-2 cursor-pointer ${
                              partyConfig.emoteRule === 'none'
                                ? 'bg-rose-500/25 border-rose-400'
                                : 'bg-[#0b4ca0] border-white/10 hover:bg-[#1164cb]'
                            }`}
                          >
                            <div className="font-display text-xs font-extrabold text-white">
                              Ningún Emote
                            </div>
                            <div className="text-[11px] text-sky-200">
                              Desactiva todos los emotes
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setEmoteRule('custom')}
                            className={`rounded-xl p-2.5 text-left border-2 cursor-pointer ${
                              partyConfig.emoteRule === 'custom'
                                ? 'bg-amber-400/25 border-amber-300'
                                : 'bg-[#0b4ca0] border-white/10 hover:bg-[#1164cb]'
                            }`}
                          >
                            <div className="font-display text-xs font-extrabold text-white">
                              Elegir Emotes ({partyConfig.allowedEmotes.length}/18)
                            </div>
                            <div className="text-[11px] text-sky-200">
                              Marca cuáles quieres permitir
                            </div>
                          </button>
                        </div>

                        {partyConfig.emoteRule === 'custom' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateParty({
                                    ...partyConfig,
                                    allowedEmotes: EMOTES_CATALOG.map((e) => e.id),
                                  })
                                }
                                className="rounded-lg bg-[#0b4ca0] hover:bg-[#1164cb] px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                              >
                                Marcar Todos
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateParty({
                                    ...partyConfig,
                                    allowedEmotes: EMOTES_CATALOG.filter(
                                      (e) => e.category === 'especial',
                                    ).map((e) => e.id),
                                  })
                                }
                                className="rounded-lg bg-rose-600 hover:bg-rose-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                              >
                                Solo Especiales
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateParty({
                                    ...partyConfig,
                                    allowedEmotes: EMOTES_CATALOG.filter(
                                      (e) => e.category === 'expresion',
                                    ).map((e) => e.id),
                                  })
                                }
                                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-white cursor-pointer"
                              >
                                Solo Expresión
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateParty({ ...partyConfig, allowedEmotes: [] })
                                }
                                className="rounded-lg bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-[11px] font-bold text-slate-200 cursor-pointer"
                              >
                                Limpiar
                              </button>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                              {EMOTES_CATALOG.map((em) => {
                                const active = partyConfig.allowedEmotes.includes(em.id);
                                return (
                                  <button
                                    key={em.id}
                                    type="button"
                                    onClick={() => toggleAllowedEmote(em.id)}
                                    className={`flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-left border-2 cursor-pointer ${
                                      active
                                        ? 'bg-emerald-500/25 border-emerald-400 text-white'
                                        : 'bg-slate-900/60 border-slate-700 text-slate-400'
                                    }`}
                                  >
                                    <span className="text-base leading-none">{em.icon}</span>
                                    <span className="truncate text-[11px] font-bold">
                                      {em.name}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Footer: Save to Lobby or Play Now with Big Yellow Button */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        onUpdateParty({ ...partyConfig, active: true });
                        onSelectMode('party');
                        setModal(null);
                      }}
                      className="arcade-btn rounded-2xl bg-sky-500 hover:bg-sky-400 px-6 py-3 font-display text-base font-extrabold text-white border-2 border-sky-800 border-b-4 cursor-pointer"
                    >
                      Usar en Botón del Lobby
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        setModal(null);
                        onPlayParty(partyConfig);
                      }}
                      className="arcade-btn rounded-2xl bg-amber-400 hover:bg-amber-300 px-10 py-3 font-display text-xl font-extrabold tracking-wide text-white border-2 border-amber-800 border-b-[5px] shadow-xl cursor-pointer"
                      style={{ textShadow: '0 2px 0 #b45309' }}
                    >
                      ¡JUGAR!
                    </button>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  SHOP MODAL
              =============================================================== */}
              {modal === 'shop' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-2xl bg-[#083b7f] p-4 border-2 border-emerald-400/40">
                      <div>
                        <div className="font-display text-lg font-extrabold text-emerald-300">
                          Bolsa de Bienvenida 0.56
                        </div>
                        <p className="text-xs text-sky-200">+120 Gemas y +30 Fichas gratis</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddCurrencyPack(120, 30)}
                        className="arcade-btn rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2 font-display text-sm font-extrabold text-white border-b-4 border-emerald-800 cursor-pointer"
                      >
                        Reclamar
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-[#083b7f] p-4 border-2 border-amber-400/40">
                      <div>
                        <div className="font-display text-lg font-extrabold text-amber-300">
                          Cofre de Fichas
                        </div>
                        <p className="text-xs text-sky-200">Canjea 40 Gemas por +20 Fichas</p>
                      </div>
                      <button
                        type="button"
                        disabled={stats.gems < 40}
                        onClick={() => onAddCurrencyPack(-40, 20)}
                        className={`arcade-btn rounded-xl px-4 py-2 font-display text-sm font-extrabold border-b-4 ${
                          stats.gems >= 40
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-700 cursor-pointer'
                            : 'bg-slate-700 text-slate-400 border-slate-900 cursor-not-allowed'
                        }`}
                      >
                        40 Gemas
                      </button>
                    </div>
                  </div>

                  {/* Featured Special Emotes 0.56 */}
                  <div>
                    <h3 className="mb-2.5 font-display text-base font-extrabold text-rose-300">
                      Emotes Especiales 0.56
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {EMOTES_CATALOG.filter((e) => e.category === 'especial').map((em) => {
                        const owned = stats.unlockedEmotes.includes(em.id);
                        return (
                          <div
                            key={em.id}
                            className="flex items-center justify-between rounded-xl bg-[#083b7f] px-3.5 py-2.5 border border-white/10"
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-xl border-2 border-white/70"
                                style={{ backgroundColor: em.bubbleColor }}
                              >
                                {em.icon}
                              </span>
                              <div>
                                <div className="font-display text-sm font-extrabold">{em.name}</div>
                                <div className="text-[11px] text-sky-200">{em.rarity}</div>
                              </div>
                            </div>
                            {owned ? (
                              <span className="rounded-lg bg-emerald-500/25 px-2.5 py-1 text-xs font-bold text-emerald-300">
                                Desbloqueado
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={stats.gems < em.priceGems}
                                  onClick={() => onUnlockEmote(em, 'gems')}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                                    stats.gems >= em.priceGems
                                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer'
                                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  {em.priceGems} G
                                </button>
                                {em.priceTokens && (
                                  <button
                                    type="button"
                                    disabled={stats.tokens < em.priceTokens}
                                    onClick={() => onUnlockEmote(em, 'tokens')}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                                      stats.tokens >= em.priceTokens
                                        ? 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white cursor-pointer'
                                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {em.priceTokens} S
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skins in Shop */}
                  <div>
                    <h3 className="mb-2.5 font-display text-base font-extrabold text-white">
                      Skins Disponibles en Tienda
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {CLASSIC_SKINS.filter((s) => s.priceGems > 0).map((skin) => {
                        const owned = stats.unlockedSkins.includes(skin.id);
                        return (
                          <div
                            key={skin.id}
                            className="flex items-center justify-between rounded-xl bg-[#083b7f] px-3.5 py-2.5 border border-white/10"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="h-10 w-10 rounded-xl border-2 border-white/80"
                                style={{
                                  backgroundColor:
                                    '#' + skin.bodyColor.toString(16).padStart(6, '0'),
                                }}
                              />
                              <div>
                                <div className="font-display text-sm font-extrabold">
                                  {skin.name}
                                </div>
                                <div className="text-[11px] text-sky-200">{skin.rarity}</div>
                              </div>
                            </div>
                            {owned ? (
                              <span className="rounded-lg bg-emerald-500/25 px-2.5 py-1 text-xs font-bold text-emerald-300">
                                Comprada
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={stats.gems < skin.priceGems}
                                  onClick={() => onUnlockSkin(skin, 'gems')}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                                    stats.gems >= skin.priceGems
                                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white cursor-pointer'
                                      : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                  }`}
                                >
                                  {skin.priceGems} G
                                </button>
                                {skin.priceTokens && (
                                  <button
                                    type="button"
                                    disabled={stats.tokens < skin.priceTokens}
                                    onClick={() => onUnlockSkin(skin, 'tokens')}
                                    className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                                      stats.tokens >= skin.priceTokens
                                        ? 'bg-fuchsia-500 hover:bg-fuchsia-400 text-white cursor-pointer'
                                        : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                                    }`}
                                  >
                                    {skin.priceTokens} S
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  FREE PRIZES WHEEL
              =============================================================== */}
              {modal === 'prizes' && (
                <div className="flex flex-col items-center text-center py-4">
                  <div
                    className={`flex h-28 w-28 items-center justify-center rounded-full bg-amber-400 border-4 border-white shadow-2xl ${
                      spinning ? 'animate-spin' : ''
                    }`}
                  >
                    <Gift className="h-14 w-14 text-slate-950" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-extrabold text-white">
                    ¡Gira y gana Gemas, Fichas o Skins 0.56!
                  </h3>
                  <p className="mt-1 text-sm text-sky-200">
                    Disponible cada minuto de forma gratuita.
                  </p>

                  {spinResult && (
                    <div className="mt-4 rounded-xl bg-emerald-500 px-5 py-2.5 font-display text-lg font-extrabold text-white shadow">
                      {spinResult}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!canFreeSpin || spinning}
                    onClick={handleSpinWheel}
                    className={`arcade-btn mt-6 rounded-2xl px-8 py-3.5 font-display text-lg font-extrabold border-b-4 ${
                      canFreeSpin && !spinning
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-700 cursor-pointer'
                        : 'bg-slate-700 text-slate-400 border-slate-900 cursor-not-allowed'
                    }`}
                  >
                    {spinning
                      ? 'Girando...'
                      : canFreeSpin
                        ? '¡GIRAR GRATIS!'
                        : 'Vuelve en 1 minuto'}
                  </button>
                </div>
              )}

              {/* ===============================================================
                  STUMBLE PASS 0.56
              =============================================================== */}
              {modal === 'pass' && (
                <div className="space-y-3">
                  <p className="text-sm text-sky-100">
                    Juega rondas para ganar estrellas de Pase (actualmente {stats.passXp}/50 · Nivel de Pase {stats.passTier}).
                  </p>
                  {PASS_TIERS.map((pt) => {
                    const unlocked = stats.passTier >= pt.tier;
                    const claimed = stats.claimedPassTiers.includes(pt.tier);
                    return (
                      <div
                        key={pt.tier}
                        className="flex items-center justify-between rounded-2xl bg-[#083b7f] px-4 py-3 border border-white/15"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 font-display text-lg font-extrabold text-slate-950">
                            {pt.tier}
                          </div>
                          <div>
                            <div className="font-display text-base font-extrabold">{pt.label}</div>
                            <div className="text-xs text-sky-200">Nivel de Pase {pt.tier}</div>
                          </div>
                        </div>
                        {claimed ? (
                          <span className="rounded-xl bg-emerald-500/25 px-3 py-1.5 text-xs font-extrabold text-emerald-300">
                            Reclamado
                          </span>
                        ) : unlocked ? (
                          <button
                            type="button"
                            onClick={() =>
                              onClaimPassTier(pt.tier, pt.rewardType, pt.amount, pt.skinId)
                            }
                            className="arcade-btn rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2 text-xs font-extrabold text-slate-950 border-b-4 border-amber-700 cursor-pointer"
                          >
                            Reclamar
                          </button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                            <Lock className="h-3.5 w-3.5" /> Bloqueado
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ===============================================================
                  DAILY MISSIONS
              =============================================================== */}
              {modal === 'missions' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#083b7f] px-4 py-3 border border-white/15">
                    <p className="text-xs sm:text-sm text-sky-100">
                      Completa desafíos a lo largo de tus partidas para ganar Gemas y Fichas extra.
                    </p>
                    <span className="rounded-lg bg-[#062f68] px-2.5 py-1 font-mono-num text-xs font-extrabold text-amber-300 whitespace-nowrap shrink-0">
                      {claimedMissionsCount}/{dailyMissions.length} reclamadas
                    </span>
                  </div>

                  {dailyMissions.map((mission) => {
                    const current = stats.dailyProgress[mission.metric] || 0;
                    const clamped = Math.min(current, mission.target);
                    const pct = Math.min(100, (clamped / mission.target) * 100);
                    const completed = current >= mission.target;
                    const claimed = stats.claimedMissions.includes(mission.id);

                    return (
                      <div
                        key={mission.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4 border-2 ${
                          claimed
                            ? 'bg-[#07316b] border-emerald-500/35'
                            : completed
                              ? 'bg-[#0b4ba0] border-amber-300'
                              : 'bg-[#083b7f] border-white/15'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-base font-extrabold text-white">
                              {mission.title}
                            </h3>
                            {claimed && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/25 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300">
                                <Check className="h-3 w-3" /> Completada
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-sky-200">{mission.description}</p>

                          <div className="mt-2.5 flex items-center gap-3">
                            <div className="relative h-5 flex-1 overflow-hidden rounded-lg bg-slate-950/80 border border-slate-900">
                              <div
                                className={`h-full transition-all ${
                                  completed ? 'bg-emerald-400' : 'bg-sky-400'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                              <span className="absolute inset-0 flex items-center justify-center font-mono-num text-[11px] font-extrabold text-white">
                                {clamped}/{mission.target}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 rounded-lg bg-[#062f68] px-2.5 py-1 font-mono-num text-xs font-extrabold text-emerald-300 border border-white/10">
                              <Gem className="h-3.5 w-3.5 text-emerald-400 fill-emerald-400" />
                              +{mission.rewardGems}
                            </span>
                            <span className="flex items-center gap-1 rounded-lg bg-[#062f68] px-2.5 py-1 font-mono-num text-xs font-extrabold text-fuchsia-300 border border-white/10">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fuchsia-500 text-[10px] font-extrabold text-white">
                                S
                              </span>
                              +{mission.rewardTokens}
                            </span>
                          </div>

                          {claimed ? (
                            <span className="rounded-xl bg-emerald-500/25 px-3.5 py-1.5 text-xs font-extrabold text-emerald-300 whitespace-nowrap">
                              Reclamada
                            </span>
                          ) : completed ? (
                            <button
                              type="button"
                              onClick={() => onClaimMission(mission)}
                              className="arcade-btn rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2 font-display text-xs font-extrabold text-slate-950 border-b-4 border-amber-700 cursor-pointer whitespace-nowrap"
                            >
                              Reclamar
                            </button>
                          ) : (
                            <span className="rounded-xl bg-[#062f68] px-3 py-1.5 text-xs font-bold text-sky-200 whitespace-nowrap">
                              En progreso
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ===============================================================
                  RANKING
              =============================================================== */}
              {modal === 'ranking' && (
                <div className="space-y-2">
                  {[
                    { name: stats.playerName, crowns: stats.crowns, trophies: stats.trophies, isMe: true },
                    { name: BOT_NAMES[0], crowns: 14, trophies: 640, isMe: false },
                    { name: BOT_NAMES[2], crowns: 9, trophies: 420, isMe: false },
                    { name: BOT_NAMES[4], crowns: 5, trophies: 290, isMe: false },
                    { name: BOT_NAMES[7], crowns: 2, trophies: 120, isMe: false },
                  ]
                    .sort((a, b) => b.trophies - a.trophies)
                    .map((row, idx) => (
                      <div
                        key={row.name + idx}
                        className={`flex items-center justify-between rounded-xl px-4 py-2.5 ${
                          row.isMe
                            ? 'bg-amber-400/25 border-2 border-amber-300'
                            : 'bg-[#083b7f] border border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono-num text-sm font-extrabold text-amber-300 w-5">
                            #{idx + 1}
                          </span>
                          <span className="flex items-center gap-1.5 font-display font-extrabold">
                            {row.isMe && stats.tournamentWins > 0 && (
                              <WBadge color={stats.wBadgeColor} size="xs" />
                            )}
                            <span>
                              {row.name} {row.isMe ? '(Tú)' : ''}
                            </span>
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                          <span className="flex items-center gap-1 text-amber-300 font-mono-num">
                            <Crown className="h-3.5 w-3.5" /> {row.crowns}
                          </span>
                          <span className="flex items-center gap-1 text-sky-200 font-mono-num">
                            <Trophy className="h-3.5 w-3.5" /> {row.trophies}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* ===============================================================
                  TOURNAMENTS & ALL 8 MAPS SELECTOR
              =============================================================== */}
              {modal === 'tournaments' && (
                <div className="space-y-4">
                  <div
                    className={`rounded-2xl p-4 border-2 ${
                      selectedMode === 'tournament'
                        ? 'bg-amber-400/20 border-amber-300'
                        : 'bg-[#083b7f] border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="font-display text-lg font-extrabold text-amber-300">
                          Torneo Oficial Stumble 0.56 (6 Fases)
                        </div>
                        <p className="mt-0.5 text-xs text-sky-100">
                          Supera las 6 fases hasta La Final para ganar Gemas, Fichas, una Skin gratis y la W permanente en tu nombre.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundManager.playButtonClick();
                          onSelectMode('tournament');
                          setModal(null);
                        }}
                        className="arcade-btn shrink-0 rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-2.5 font-display text-sm font-extrabold text-slate-950 border-b-4 border-amber-700 cursor-pointer"
                      >
                        {selectedMode === 'tournament' ? 'Torneo Seleccionado' : 'Elegir Torneo'}
                      </button>
                    </div>

                    {/* 6 Tournament Phases */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-6 gap-2">
                      {TOURNAMENT_STAGES.map((st) => (
                        <div
                          key={st.index}
                          className={`rounded-xl px-2.5 py-2 border text-center ${
                            st.isFinal
                              ? 'bg-amber-400/25 border-amber-300'
                              : 'bg-[#062f68] border-white/10'
                          }`}
                        >
                          <div className="font-mono-num text-[10px] font-bold text-sky-200">
                            Fase {st.index + 1}
                          </div>
                          <div className="font-display text-xs font-extrabold text-white leading-tight">
                            {st.name}
                          </div>
                          <div className="mt-0.5 font-mono-num text-[11px] font-bold text-amber-300">
                            {st.totalPlayers} → {st.isFinal ? '1 Campeón' : st.qualifyCount}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Champion Rewards Summary + W Color Selector */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#062f68] px-3 py-2.5 border border-white/10 text-xs">
                      <div className="flex flex-wrap items-center gap-3 font-bold text-white">
                        <span className="text-amber-300 font-extrabold">Premio al Campeón:</span>
                        <span className="text-emerald-300">+42,000 Gemas</span>
                        <span className="text-fuchsia-300">+45 Fichas</span>
                        <span className="text-sky-200">+1 Skin Gratis</span>
                        <span className="inline-flex items-center gap-1 text-white">
                          <WBadge color={stats.wBadgeColor} size="xs" /> Permanente
                        </span>
                      </div>

                      {stats.tournamentWins > 0 && (
                        <WColorSelector
                          value={stats.wBadgeColor}
                          onChange={onChangeWColor}
                          compact
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                  {ALL_MAP_IDS.map((id) => {
                    const m = MAPS_META[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onSelectMode(id);
                          setModal(null);
                        }}
                        className={`flex flex-col items-start rounded-2xl p-4 text-left border-2 cursor-pointer ${
                          selectedMode === id
                            ? 'bg-amber-400/20 border-amber-300'
                            : 'bg-[#083b7f] border-white/10 hover:bg-[#0d4899]'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="font-display text-base font-extrabold text-white">
                            {m.name}
                          </span>
                          <span className="rounded-md bg-[#062f68] px-2 py-0.5 text-[10px] font-extrabold text-sky-200">
                            {m.type === 'survival' ? 'Supervivencia' : 'Carrera'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-sky-100">{m.subtitle}</p>
                      </button>
                    );
                  })}
                  </div>
                </div>
              )}

              {/* ===============================================================
                  NEWS 0.56
              =============================================================== */}
              {modal === 'news' && (
                <div className="space-y-3 text-sm text-sky-100">
                  <div className="rounded-2xl bg-[#083b7f] p-4 border border-amber-400/35">
                    <h3 className="font-display text-base font-extrabold text-amber-300">
                      ¡Actualización Stumble Guys v0.56 Completa!
                    </h3>
                    <p className="mt-1">
                      Incluye 30 Skins, 18 Emotes (¡Puñetazo, Patada, Abrazo, Plátano, Balón, Espada Rayo, Invisibilidad y Escudo!), 6 Huellas, 4 Animaciones de Victoria y 8 Mapas incluyendo Block Dash, Laser Tracer, Lava Land, Super Slide y Cannon Climb.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                    <h3 className="font-display text-base font-extrabold text-sky-300">
                      Nuevo Sistema de Grupo (Normal y Personalizada)
                    </h3>
                    <p className="mt-1">
                      Abre el botón GRUPO para crear salas con amigos: juega Partida Normal apretando el botón amarillo, o crea una Partida Personalizada eligiendo mapas, rondas y exactamente qué emotes permitir o desactivar.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                    <h3 className="font-display text-base font-extrabold text-emerald-300">
                      Controles de Emotes y Plancha
                    </h3>
                    <p className="mt-1">
                      Usa las teclas 1, 2, 3 y 4 durante la partida para activar tus emotes equipados, y Doble Espacio o Shift para hacer la plancha y romper bloques agrietados en Block Dash.
                    </p>
                  </div>
                </div>
              )}

              {/* ===============================================================
                  SETTINGS
              =============================================================== */}
              {modal === 'settings' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                    <div>
                      <div className="font-display text-base font-extrabold">Audio General</div>
                      <div className="text-xs text-sky-200">Silenciar o activar todo el sonido</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        soundManager.playButtonClick();
                        onToggleMute();
                      }}
                      className="flex items-center gap-2 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2 text-xs font-extrabold cursor-pointer"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      <span>{muted ? 'Silenciado' : 'Activado'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                      <div>
                        <div className="font-display text-sm font-extrabold">Efectos (SFX)</div>
                        <div className="text-xs text-sky-200">Saltos, choques, emotes</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !sfxOn;
                          setSfxOn(next);
                          soundManager.setSfxEnabled(next);
                          if (next) soundManager.playButtonClick();
                        }}
                        className={`rounded-xl px-3.5 py-2 text-xs font-extrabold cursor-pointer ${
                          sfxOn ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {sfxOn ? 'Activo' : 'Apagado'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl bg-[#083b7f] p-4 border border-white/15">
                      <div>
                        <div className="font-display text-sm font-extrabold">Música Arcade</div>
                        <div className="text-xs text-sky-200">Melodía durante rondas</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !musicOn;
                          setMusicOn(next);
                          soundManager.setMusicEnabled(next);
                          soundManager.playButtonClick();
                        }}
                        className={`rounded-xl px-3.5 py-2 text-xs font-extrabold cursor-pointer ${
                          musicOn ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-300'
                        }`}
                      >
                        {musicOn ? 'Activa' : 'Apagada'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-[#083b7f] p-4 border border-white/15 text-sm space-y-2">
                    <div className="font-display text-base font-extrabold text-amber-300">
                      Controles
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-200">Moverse</span>
                      <span className="font-mono-num font-bold">WASD / Flechas</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-200">Saltar</span>
                      <span className="font-mono-num font-bold">Espacio</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-200">Plancha (Aire)</span>
                      <span className="font-mono-num font-bold">Doble Espacio / Shift</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-200">Emotes 1–4</span>
                      <span className="font-mono-num font-bold">Teclas 1, 2, 3, 4</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-200">Girar Cámara</span>
                      <span className="font-mono-num font-bold">Arrastrar Mouse</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface MenuTileProps {
  label: string;
  bgClass: string;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
}

const MenuTile: React.FC<MenuTileProps> = ({
  label,
  bgClass,
  icon,
  badge,
  onClick,
}) => (
  <button
    type="button"
    onClick={() => {
      soundManager.playButtonClick();
      onClick();
    }}
    className="arcade-btn group relative flex flex-col items-center cursor-pointer"
  >
    <div
      className={`flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl border-2 border-b-4 shadow-lg transition-colors ${bgClass}`}
    >
      {icon}
    </div>
    <span
      className="mt-1 font-display text-[10px] sm:text-[11px] font-extrabold tracking-wide text-white"
      style={{ textShadow: '0 2px 0 #062f68' }}
    >
      {label}
    </span>
    {badge && (
      <span className="absolute -top-1.5 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[11px] font-extrabold text-white border-2 border-white">
        {badge}
      </span>
    )}
  </button>
);
