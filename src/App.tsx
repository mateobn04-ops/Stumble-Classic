import { useEffect, useRef, useState } from 'react';
import { StumbleGameEngine } from './game/engine';
import { soundManager } from './game/audio';
import {
  ALL_MAP_IDS,
  CLASSIC_SKINS,
  EMOTES_CATALOG,
  FOOTSTEPS_CATALOG,
  MAPS_META,
  TOURNAMENT_STAGES,
  VICTORY_ANIMS_CATALOG,
} from './game/skins';
import {
  createEmptyDailyProgress,
  getDailyMissions,
  getTodayDateKey,
} from './game/missions';
import {
  DailyMission,
  EmoteConfig,
  EmoteId,
  FootstepConfig,
  FootstepId,
  GameMode,
  HudState,
  MissionMetric,
  PartyConfig,
  PlayerStats,
  SkinConfig,
  SkinId,
  TournamentRewardSummary,
  VictoryAnimConfig,
  VictoryAnimId,
  WBadgeColor,
} from './game/types';
import { LobbyOverlay } from './components/LobbyOverlay';
import { GameHud } from './components/GameHud';
import { TouchControls } from './components/TouchControls';

const STORAGE_KEY = 'stumble_classic_stats_v2';

const DEFAULT_EQUIPPED_EMOTES: [EmoteId, EmoteId, EmoteId, EmoteId] = [
  'saludo',
  'risa',
  'punetazo',
  'escudo',
];

const DEFAULT_UNLOCKED_EMOTES: EmoteId[] = [
  'saludo',
  'risa',
  'enojado',
  'punetazo',
  'escudo',
];

const DEFAULT_STATS: PlayerStats = {
  playerName: 'MALAVIDA123',
  level: 1,
  xp: 0,
  passTier: 1,
  passXp: 0,
  gems: 200,
  tokens: 40,
  crowns: 0,
  trophies: 0,
  wins: 0,
  tournamentWins: 0,
  wBadgeColor: 'rainbow',
  matches: 0,
  selectedSkin: 'sr_stumble',
  unlockedSkins: ['sr_stumble', 'rojinegro_r', 'gorra_bw', 'fantasma', 'alien_morado'],
  equippedEmotes: DEFAULT_EQUIPPED_EMOTES,
  unlockedEmotes: DEFAULT_UNLOCKED_EMOTES,
  selectedFootstep: 'normal',
  unlockedFootsteps: ['normal'],
  selectedVictoryAnim: 'baile_clasico',
  unlockedVictoryAnims: ['baile_clasico'],
  claimedPassTiers: [],
  lastFreeSpinAt: 0,
  dailyDate: getTodayDateKey(),
  dailyProgress: createEmptyDailyProgress(),
  claimedMissions: [],
};

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `SG-${suffix}`;
}

function createDefaultPartyConfig(stats: PlayerStats): PartyConfig {
  return {
    active: false,
    roomCode: generateRoomCode(),
    partyType: 'normal',
    maxPlayers: 32,
    roundCount: 3,
    selectedMaps: [ALL_MAP_IDS[0], 'block_dash', 'laser_tracer'],
    emoteRule: 'all',
    allowedEmotes: EMOTES_CATALOG.map((e) => e.id),
    members: [
      {
        id: 'host',
        name: stats.playerName,
        skinId: stats.selectedSkin,
        isHost: true,
        isFriend: false,
        ready: true,
      },
    ],
  };
}

function applyDailyProgress(
  prev: PlayerStats,
  metric: MissionMetric,
  amount = 1,
): PlayerStats {
  const today = getTodayDateKey();
  const isSameDay = prev.dailyDate === today;
  const baseProgress = isSameDay ? prev.dailyProgress : createEmptyDailyProgress();
  const baseClaimed = isSameDay ? prev.claimedMissions : [];
  return {
    ...prev,
    dailyDate: today,
    dailyProgress: {
      ...baseProgress,
      [metric]: (baseProgress[metric] || 0) + amount,
    },
    claimedMissions: baseClaimed,
  };
}

function loadStats(): PlayerStats {
  const today = getTodayDateKey();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_STATS,
        dailyDate: today,
        dailyProgress: createEmptyDailyProgress(),
        claimedMissions: [],
      };
    }
    const parsed = { ...DEFAULT_STATS, ...JSON.parse(raw) } as PlayerStats;
    if (!parsed.unlockedSkins.includes('rojinegro_r')) {
      parsed.unlockedSkins = ['rojinegro_r', ...parsed.unlockedSkins];
    }
    if (!Array.isArray(parsed.equippedEmotes) || parsed.equippedEmotes.length !== 4) {
      parsed.equippedEmotes = [...DEFAULT_EQUIPPED_EMOTES];
    }
    if (!Array.isArray(parsed.unlockedEmotes) || parsed.unlockedEmotes.length === 0) {
      parsed.unlockedEmotes = [...DEFAULT_UNLOCKED_EMOTES];
    }
    for (const defEm of DEFAULT_UNLOCKED_EMOTES) {
      if (!parsed.unlockedEmotes.includes(defEm)) {
        parsed.unlockedEmotes = [...parsed.unlockedEmotes, defEm];
      }
    }
    if (!FOOTSTEPS_CATALOG.some((f) => f.id === parsed.selectedFootstep)) {
      parsed.selectedFootstep = 'normal';
    }
    if (!Array.isArray(parsed.unlockedFootsteps) || !parsed.unlockedFootsteps.includes('normal')) {
      parsed.unlockedFootsteps = ['normal', ...(parsed.unlockedFootsteps || [])];
    }
    if (!VICTORY_ANIMS_CATALOG.some((v) => v.id === parsed.selectedVictoryAnim)) {
      parsed.selectedVictoryAnim = 'baile_clasico';
    }
    if (!Array.isArray(parsed.unlockedVictoryAnims) || !parsed.unlockedVictoryAnims.includes('baile_clasico')) {
      parsed.unlockedVictoryAnims = ['baile_clasico', ...(parsed.unlockedVictoryAnims || [])];
    }
    if (
      parsed.dailyDate !== today ||
      !parsed.dailyProgress ||
      !Array.isArray(parsed.claimedMissions)
    ) {
      parsed.dailyDate = today;
      parsed.dailyProgress = createEmptyDailyProgress();
      parsed.claimedMissions = [];
    } else {
      parsed.dailyProgress = {
        ...createEmptyDailyProgress(),
        ...parsed.dailyProgress,
      };
    }
    if (typeof parsed.tournamentWins !== 'number') {
      parsed.tournamentWins = 0;
    }
    if (
      parsed.wBadgeColor !== 'blue' &&
      parsed.wBadgeColor !== 'red' &&
      parsed.wBadgeColor !== 'rainbow'
    ) {
      parsed.wBadgeColor = 'rainbow';
    }
    return parsed;
  } catch {
    return {
      ...DEFAULT_STATS,
      dailyDate: today,
      dailyProgress: createEmptyDailyProgress(),
      claimedMissions: [],
    };
  }
}

const INITIAL_HUD: HudState = {
  phase: 'lobby',
  roundNumber: 1,
  totalRounds: 6,
  isTournament: true,
  stageName: TOURNAMENT_STAGES[0].name,
  stages: TOURNAMENT_STAGES,
  mapMeta: MAPS_META.circuito_caos,
  qualifyCount: 0,
  qualifyTarget: 24,
  aliveCount: 32,
  totalContestants: 32,
  countdownText: '',
  elapsedTime: 0,
  playerQualified: false,
  playerEliminated: false,
  playerRank: null,
  winnerName: '',
  feedText: '',
  emotesEnabled: true,
  emoteSlots: DEFAULT_EQUIPPED_EMOTES.map(
    (id) => EMOTES_CATALOG.find((e) => e.id === id) || EMOTES_CATALOG[0],
  ),
  emoteCooldowns: {},
  shieldActive: false,
  invisActive: false,
  partyBadge: null,
  tournamentReward: null,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<StumbleGameEngine | null>(null);

  const [stats, setStats] = useState<PlayerStats>(loadStats);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  const [selectedMode, setSelectedMode] = useState<GameMode>('tournament');
  const [partyConfig, setPartyConfig] = useState<PartyConfig>(() =>
    createDefaultPartyConfig(loadStats()),
  );
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [lastTournamentReward, setLastTournamentReward] =
    useState<TournamentRewardSummary | null>(null);
  const [muted, setMuted] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // Ignore storage quota issues
    }
  }, [stats]);

  // Keep host member synced with player name & skin
  useEffect(() => {
    setPartyConfig((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.isHost ? { ...m, name: stats.playerName, skinId: stats.selectedSkin } : m,
      ),
    }));
  }, [stats.playerName, stats.selectedSkin]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const engine = new StumbleGameEngine(container, {
      onHudUpdate: (nextHud) => setHud(nextHud),
      onTournamentCrown: (_winnerName, playerWon, isFullTournament) => {
        if (playerWon && isFullTournament) {
          const current = statsRef.current;
          const lockedSkins = CLASSIC_SKINS.filter(
            (s) => !current.unlockedSkins.includes(s.id),
          );
          const wonSkin =
            lockedSkins.length > 0
              ? lockedSkins[Math.floor(Math.random() * lockedSkins.length)]
              : null;
          const bonusGems = 42000;
          const bonusTokens = wonSkin ? 45 : 75;
          const wBadgeUnlockedNow = current.tournamentWins === 0;

          setLastTournamentReward({
            gems: bonusGems,
            tokens: bonusTokens,
            unlockedSkinName: wonSkin?.name,
            unlockedSkinRarity: wonSkin?.rarity,
            wBadgeUnlockedNow,
          });
          soundManager.playUnlock();

          setStats((prev) => {
            const nextSkins =
              wonSkin && !prev.unlockedSkins.includes(wonSkin.id)
                ? [...prev.unlockedSkins, wonSkin.id]
                : prev.unlockedSkins;
            const updated: PlayerStats = {
              ...prev,
              crowns: prev.crowns + 1,
              trophies: prev.trophies + 50,
              wins: prev.wins + 1,
              tournamentWins: prev.tournamentWins + 1,
              gems: prev.gems + bonusGems,
              tokens: prev.tokens + bonusTokens,
              unlockedSkins: nextSkins,
            };
            return applyDailyProgress(updated, 'crowns_won', 1);
          });
        } else {
          setLastTournamentReward(null);
          setStats((prev) => {
            const updated: PlayerStats = {
              ...prev,
              crowns: prev.crowns + (playerWon ? 1 : 0),
              trophies: prev.trophies + (playerWon ? 30 : 5),
              wins: prev.wins + (playerWon ? 1 : 0),
            };
            return playerWon ? applyDailyProgress(updated, 'crowns_won', 1) : updated;
          });
        }
      },
      onMissionProgress: (metric, amount = 1) => {
        setStats((prev) => applyDailyProgress(prev, metric, amount));
      },
      onRoundReward: (qualified, wonCrown) => {
        setStats((prev) => {
          const gainedXp = wonCrown ? 45 : qualified ? 25 : 15;
          const totalXp = prev.xp + gainedXp;
          const levelUps = Math.floor(totalXp / 100);
          const nextPassTotal = prev.passXp + gainedXp;
          const passUps = Math.floor(nextPassTotal / 50);

          if (levelUps > 0 || passUps > 0) {
            soundManager.playLevelUp();
          }

          return {
            ...prev,
            level: prev.level + levelUps,
            xp: totalXp % 100,
            passTier: prev.passTier + passUps,
            passXp: nextPassTotal % 50,
            gems: prev.gems + (wonCrown ? 35 : qualified ? 18 : 5),
            tokens: prev.tokens + (wonCrown ? 10 : qualified ? 5 : 2),
          };
        });
      },
      onWebglError: () => setWebglLost(true),
    });

    engine.setPlayerCustomization(
      stats.selectedSkin,
      stats.playerName,
      stats.equippedEmotes,
      stats.selectedFootstep,
      stats.selectedVictoryAnim,
      stats.tournamentWins > 0,
      stats.wBadgeColor,
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPlayerCustomization(
      stats.selectedSkin,
      stats.playerName,
      stats.equippedEmotes,
      stats.selectedFootstep,
      stats.selectedVictoryAnim,
      stats.tournamentWins > 0,
      stats.wBadgeColor,
    );
  }, [
    stats.selectedSkin,
    stats.playerName,
    stats.equippedEmotes,
    stats.selectedFootstep,
    stats.selectedVictoryAnim,
    stats.tournamentWins,
    stats.wBadgeColor,
  ]);

  const handleToggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.sound.setMuted(next);
      return next;
    });
  };

  const handlePlay = () => {
    setLastTournamentReward(null);
    setStats((prev) =>
      applyDailyProgress({ ...prev, matches: prev.matches + 1 }, 'matches_played', 1),
    );
    if (selectedMode === 'party') {
      engineRef.current?.startPartyMatch(partyConfig);
    } else {
      engineRef.current?.startGame(selectedMode);
    }
  };

  const handlePlayParty = (nextParty: PartyConfig) => {
    setLastTournamentReward(null);
    const activeParty: PartyConfig = { ...nextParty, active: true };
    setPartyConfig(activeParty);
    setSelectedMode('party');
    setStats((prev) =>
      applyDailyProgress({ ...prev, matches: prev.matches + 1 }, 'matches_played', 1),
    );
    engineRef.current?.startPartyMatch(activeParty);
  };

  const handleSelectSkin = (skinId: SkinId) => {
    soundManager.playButtonClick();
    setStats((prev) => ({ ...prev, selectedSkin: skinId }));
  };

  const handleUnlockSkin = (skin: SkinConfig, currency: 'gems' | 'tokens') => {
    let unlockedNow = false;
    setStats((prev) => {
      if (prev.unlockedSkins.includes(skin.id)) return prev;
      if (currency === 'gems') {
        if (prev.gems < skin.priceGems) return prev;
        unlockedNow = true;
        return {
          ...prev,
          gems: prev.gems - skin.priceGems,
          unlockedSkins: [...prev.unlockedSkins, skin.id],
          selectedSkin: skin.id,
        };
      }
      const tokenCost = skin.priceTokens || 999;
      if (prev.tokens < tokenCost) return prev;
      unlockedNow = true;
      return {
        ...prev,
        tokens: prev.tokens - tokenCost,
        unlockedSkins: [...prev.unlockedSkins, skin.id],
        selectedSkin: skin.id,
      };
    });
    if (unlockedNow) {
      soundManager.playUnlock();
    }
  };

  const handleEquipEmote = (slotIndex: number, emoteId: EmoteId) => {
    soundManager.playButtonClick();
    setStats((prev) => {
      if (!prev.unlockedEmotes.includes(emoteId)) return prev;
      const nextSlots = [...prev.equippedEmotes] as [EmoteId, EmoteId, EmoteId, EmoteId];
      const existingIdx = nextSlots.indexOf(emoteId);
      if (existingIdx !== -1 && existingIdx !== slotIndex) {
        nextSlots[existingIdx] = nextSlots[slotIndex];
      }
      nextSlots[slotIndex] = emoteId;
      return { ...prev, equippedEmotes: nextSlots };
    });
  };

  const handleUnlockEmote = (emote: EmoteConfig, currency: 'gems' | 'tokens') => {
    let unlockedNow = false;
    setStats((prev) => {
      if (prev.unlockedEmotes.includes(emote.id)) return prev;
      if (currency === 'gems') {
        if (prev.gems < emote.priceGems) return prev;
        unlockedNow = true;
        return {
          ...prev,
          gems: prev.gems - emote.priceGems,
          unlockedEmotes: [...prev.unlockedEmotes, emote.id],
        };
      }
      const tokenCost = emote.priceTokens || 999;
      if (prev.tokens < tokenCost) return prev;
      unlockedNow = true;
      return {
        ...prev,
        tokens: prev.tokens - tokenCost,
        unlockedEmotes: [...prev.unlockedEmotes, emote.id],
      };
    });
    if (unlockedNow) {
      soundManager.playUnlock();
    }
  };

  const handleSelectFootstep = (footstepId: FootstepId) => {
    soundManager.playButtonClick();
    setStats((prev) => ({ ...prev, selectedFootstep: footstepId }));
  };

  const handleUnlockFootstep = (footstep: FootstepConfig) => {
    let unlockedNow = false;
    setStats((prev) => {
      if (prev.unlockedFootsteps.includes(footstep.id) || prev.gems < footstep.priceGems) {
        return prev;
      }
      unlockedNow = true;
      return {
        ...prev,
        gems: prev.gems - footstep.priceGems,
        unlockedFootsteps: [...prev.unlockedFootsteps, footstep.id],
        selectedFootstep: footstep.id,
      };
    });
    if (unlockedNow) {
      soundManager.playUnlock();
    }
  };

  const handleSelectVictoryAnim = (animId: VictoryAnimId) => {
    soundManager.playButtonClick();
    setStats((prev) => ({ ...prev, selectedVictoryAnim: animId }));
  };

  const handleUnlockVictoryAnim = (anim: VictoryAnimConfig) => {
    let unlockedNow = false;
    setStats((prev) => {
      if (prev.unlockedVictoryAnims.includes(anim.id) || prev.gems < anim.priceGems) {
        return prev;
      }
      unlockedNow = true;
      return {
        ...prev,
        gems: prev.gems - anim.priceGems,
        unlockedVictoryAnims: [...prev.unlockedVictoryAnims, anim.id],
        selectedVictoryAnim: anim.id,
      };
    });
    if (unlockedNow) {
      soundManager.playUnlock();
    }
  };

  const handleClaimFreePrize = (reward: {
    type: 'gems' | 'tokens' | 'skin';
    amount: number;
    skinId?: SkinId;
  }) => {
    if (reward.type === 'skin') {
      soundManager.playUnlock();
    } else {
      soundManager.playCoin();
    }
    setStats((prev) => {
      const next: PlayerStats = {
        ...prev,
        lastFreeSpinAt: Date.now(),
      };
      if (reward.type === 'gems') next.gems += reward.amount;
      if (reward.type === 'tokens') next.tokens += reward.amount;
      if (reward.type === 'skin' && reward.skinId) {
        if (!next.unlockedSkins.includes(reward.skinId)) {
          next.unlockedSkins = [...next.unlockedSkins, reward.skinId];
        }
        next.selectedSkin = reward.skinId;
      }
      return next;
    });
  };

  const handleClaimPassTier = (
    tier: number,
    rewardType: 'gems' | 'tokens' | 'skin',
    amount: number,
    skinId?: SkinId,
  ) => {
    soundManager.playLevelUp();
    setStats((prev) => {
      if (prev.claimedPassTiers.includes(tier) || prev.passTier < tier) return prev;
      const next: PlayerStats = {
        ...prev,
        claimedPassTiers: [...prev.claimedPassTiers, tier],
      };
      if (rewardType === 'gems') next.gems += amount;
      if (rewardType === 'tokens') next.tokens += amount;
      if (rewardType === 'skin' && skinId && !next.unlockedSkins.includes(skinId)) {
        next.unlockedSkins = [...next.unlockedSkins, skinId];
      }
      return next;
    });
  };

  const handleAddCurrencyPack = (gemsDelta: number, tokensDelta: number) => {
    soundManager.playCoin();
    setStats((prev) => {
      if (prev.gems + gemsDelta < 0 || prev.tokens + tokensDelta < 0) return prev;
      return {
        ...prev,
        gems: prev.gems + gemsDelta,
        tokens: prev.tokens + tokensDelta,
      };
    });
  };

  const handleChangeName = (name: string) => {
    setStats((prev) => ({ ...prev, playerName: name }));
  };

  const handleChangeWColor = (color: WBadgeColor) => {
    soundManager.playButtonClick();
    setStats((prev) => ({ ...prev, wBadgeColor: color }));
  };

  const handleClaimMission = (mission: DailyMission) => {
    let claimedNow = false;
    const today = getTodayDateKey();
    setStats((prev) => {
      if (prev.dailyDate !== today) {
        return {
          ...prev,
          dailyDate: today,
          dailyProgress: createEmptyDailyProgress(),
          claimedMissions: [],
        };
      }
      if (prev.claimedMissions.includes(mission.id)) return prev;
      const currentVal = prev.dailyProgress[mission.metric] || 0;
      if (currentVal < mission.target) return prev;
      claimedNow = true;
      return {
        ...prev,
        gems: prev.gems + mission.rewardGems,
        tokens: prev.tokens + mission.rewardTokens,
        claimedMissions: [...prev.claimedMissions, mission.id],
      };
    });
    if (claimedNow) {
      soundManager.playCoin();
      soundManager.playLevelUp();
    }
  };

  const todayKey = getTodayDateKey();
  const activeStats: PlayerStats =
    stats.dailyDate === todayKey
      ? stats
      : {
          ...stats,
          dailyDate: todayKey,
          dailyProgress: createEmptyDailyProgress(),
          claimedMissions: [],
        };
  const dailyMissions = getDailyMissions(todayKey);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-sky-500">
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Escenario 3D de Stumble Classic"
      />

      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center text-white">
          <div className="max-w-sm rounded-2xl bg-slate-900 p-6 border border-white/15">
            <h2 className="font-display text-2xl font-extrabold text-amber-300">
              Contexto WebGL perdido
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Tu navegador reinició los gráficos 3D. Recarga la página para volver a jugar.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-amber-400 px-5 py-2.5 font-display font-bold text-slate-950 cursor-pointer"
            >
              Recargar
            </button>
          </div>
        </div>
      )}

      {hud.phase === 'lobby' ? (
        <LobbyOverlay
          stats={activeStats}
          dailyMissions={dailyMissions}
          selectedMode={selectedMode}
          partyConfig={partyConfig}
          muted={muted}
          onSelectMode={setSelectedMode}
          onUpdateParty={(next) => setPartyConfig(next)}
          onPlayParty={handlePlayParty}
          onSelectSkin={handleSelectSkin}
          onUnlockSkin={handleUnlockSkin}
          onEquipEmote={handleEquipEmote}
          onUnlockEmote={handleUnlockEmote}
          onSelectFootstep={handleSelectFootstep}
          onUnlockFootstep={handleUnlockFootstep}
          onSelectVictoryAnim={handleSelectVictoryAnim}
          onUnlockVictoryAnim={handleUnlockVictoryAnim}
          onClaimFreePrize={handleClaimFreePrize}
          onClaimPassTier={handleClaimPassTier}
          onClaimMission={handleClaimMission}
          onAddCurrencyPack={handleAddCurrencyPack}
          onChangeName={handleChangeName}
          onChangeWColor={handleChangeWColor}
          onToggleMute={handleToggleMute}
          onPlay={handlePlay}
        />
      ) : (
        <>
          <GameHud
            hud={{ ...hud, tournamentReward: lastTournamentReward }}
            playerName={stats.playerName}
            hasTournamentW={stats.tournamentWins > 0}
            wBadgeColor={stats.wBadgeColor}
            onChangeWColor={handleChangeWColor}
            muted={muted}
            onToggleMute={handleToggleMute}
            onExitToLobby={() => {
              setLastTournamentReward(null);
              engineRef.current?.returnToLobby();
            }}
            onNextRound={() => engineRef.current?.nextTournamentRound()}
            onPlayAgain={() => {
              setLastTournamentReward(null);
              if (selectedMode === 'party') {
                engineRef.current?.startPartyMatch(partyConfig);
              } else {
                engineRef.current?.startGame(selectedMode);
              }
            }}
            onTriggerEmote={(slotIndex) => engineRef.current?.triggerEmoteSlot(slotIndex)}
          />
          {hud.phase === 'playing' && !hud.playerQualified && !hud.playerEliminated && (
            <TouchControls
              onMove={(x, y) => engineRef.current?.setTouchMove(x, y)}
              onJump={() => engineRef.current?.triggerTouchJump()}
              onDive={() => engineRef.current?.triggerTouchDive()}
            />
          )}
        </>
      )}
    </div>
  );
}
