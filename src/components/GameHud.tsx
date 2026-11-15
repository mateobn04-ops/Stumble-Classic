import React from 'react';
import {
  ArrowRight,
  Check,
  Crown,
  EyeOff,
  Gem,
  LogOut,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { HudState, WBadgeColor } from '../game/types';
import { WBadge, WColorSelector } from './WBadge';

interface GameHudProps {
  hud: HudState;
  playerName: string;
  hasTournamentW: boolean;
  wBadgeColor: WBadgeColor;
  onChangeWColor: (color: WBadgeColor) => void;
  muted: boolean;
  onToggleMute: () => void;
  onExitToLobby: () => void;
  onNextRound: () => void;
  onPlayAgain: () => void;
  onTriggerEmote: (slotIndex: number) => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ds = Math.floor((sec % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  playerName,
  hasTournamentW,
  wBadgeColor,
  onChangeWColor,
  muted,
  onToggleMute,
  onExitToLobby,
  onNextRound,
  onPlayAgain,
  onTriggerEmote,
}) => {
  const isSurvival = hud.mapMeta.type === 'survival';
  const nextStage =
    hud.isTournament && hud.stages[hud.roundNumber]
      ? hud.stages[hud.roundNumber]
      : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4 sm:p-5">
      {/* Top Row: Round Counter / Phase + Permanent W Badge + Timer/Controls */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Qualification / Survival Board */}
        <div className="pointer-events-auto rounded-2xl bg-slate-950/88 px-4 py-2.5 text-white shadow-lg border border-white/15">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-sky-300">
            {hud.isTournament ? (
              <span className="font-display font-extrabold text-amber-300 uppercase">
                {hud.stageName} ({hud.roundNumber}/{hud.totalRounds})
              </span>
            ) : (
              <span>
                Ronda {hud.roundNumber}/{hud.totalRounds}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="text-white">{hud.mapMeta.name}</span>
            {hud.partyBadge && (
              <>
                <span aria-hidden="true">·</span>
                <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono-num text-[10px] font-extrabold text-slate-950">
                  {hud.partyBadge}
                </span>
              </>
            )}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            {isSurvival && hud.qualifyTarget === 1 ? (
              <>
                <span className="font-mono-num text-2xl font-extrabold text-amber-300">
                  {hud.aliveCount}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  / {hud.totalContestants} En pie
                </span>
              </>
            ) : isSurvival ? (
              <>
                <span className="font-mono-num text-2xl font-extrabold text-amber-300">
                  {hud.aliveCount}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  en pie (clasifican {hud.qualifyTarget})
                </span>
              </>
            ) : (
              <>
                <span className="font-mono-num text-2xl font-extrabold text-emerald-400">
                  {hud.qualifyCount}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  / {hud.qualifyTarget} Clasificados
                </span>
              </>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 border-t border-white/10 pt-1.5 text-xs font-extrabold text-white">
            {hasTournamentW && <WBadge color={wBadgeColor} size="xs" />}
            <span className="truncate max-w-[150px] text-amber-200">{playerName}</span>
          </div>
        </div>

        {/* Feed Banner + Active Buffs */}
        <div className="hidden md:flex flex-col items-center gap-1.5">
          {hud.feedText && hud.phase === 'playing' && (
            <div className="rounded-xl bg-slate-950/88 px-4 py-2 text-sm font-bold text-amber-300 border border-white/15 shadow-lg">
              {hud.feedText}
            </div>
          )}
          {hud.phase === 'playing' && (hud.shieldActive || hud.invisActive) && (
            <div className="flex items-center gap-2">
              {hud.shieldActive && (
                <div className="flex items-center gap-1.5 rounded-xl bg-sky-600/95 px-3 py-1 text-xs font-extrabold text-white border border-sky-200/40 shadow">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Escudo Activo</span>
                </div>
              )}
              {hud.invisActive && (
                <div className="flex items-center gap-1.5 rounded-xl bg-purple-600/95 px-3 py-1 text-xs font-extrabold text-white border border-purple-200/40 shadow">
                  <EyeOff className="h-3.5 w-3.5" />
                  <span>Invisibilidad +20% Vel.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Right Timer + Actions */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-xl bg-slate-950/88 px-3.5 py-2 text-white border border-white/15 font-mono-num text-sm font-bold">
            {formatTime(hud.elapsedTime)}
          </div>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/88 text-white border border-white/15 hover:bg-slate-900 cursor-pointer"
          >
            {muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onExitToLobby}
            className="whitespace-nowrap shrink-0 flex h-10 items-center gap-1.5 rounded-xl bg-slate-950/88 px-3.5 text-xs font-bold text-white border border-white/15 hover:bg-rose-600 transition-colors cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {/* Center Banners: Countdown or End-of-Round Modals */}
      <div className="flex flex-col items-center justify-center">
        {(hud.phase === 'intro' || hud.phase === 'countdown') && (
          <div className="rounded-3xl bg-slate-950/85 px-8 py-5 text-center border border-white/20 shadow-2xl">
            <p className="text-xs font-bold tracking-wide text-sky-300">
              {hud.mapMeta.subtitle}
            </p>
            <div className="mt-1 font-display text-3xl sm:text-6xl font-extrabold text-amber-300 drop-shadow">
              {hud.countdownText}
            </div>
          </div>
        )}

        {hud.phase === 'playing' && hud.playerQualified && (
          <div className="rounded-2xl bg-emerald-600/95 px-6 py-3 text-center text-white border-2 border-white/40 shadow-2xl">
            <div className="font-display text-2xl font-extrabold">
              ¡CLASIFICADO #{hud.playerRank}!
            </div>
            <p className="text-xs font-semibold text-emerald-100">
              Esperando al resto de jugadores...
            </p>
          </div>
        )}

        {hud.phase === 'round_over' && (
          <div className="pointer-events-auto w-full max-w-lg rounded-3xl bg-slate-950/92 p-6 sm:p-7 text-center text-white border-2 border-emerald-400/60 shadow-2xl">
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-emerald-400">
              ¡CLASIFICADO!
            </div>
            <p className="mt-1.5 text-sm text-slate-200">
              {hud.isTournament ? `${hud.stageName} superada · ` : ''}Posición #{hud.playerRank} · Tiempo {formatTime(hud.elapsedTime)}
            </p>

            {hud.isTournament && hud.stages.length > 0 && (
              <div className="mt-4 rounded-2xl bg-slate-900/90 p-3 border border-white/10">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {hud.stages.map((st) => {
                    const passed = st.index < hud.roundNumber;
                    const upcoming = st.index === hud.roundNumber;
                    return (
                      <div
                        key={st.index}
                        className={`flex flex-col items-center justify-center rounded-xl px-1.5 py-2 border text-center ${
                          passed
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : upcoming
                              ? 'bg-amber-400/25 border-amber-300 text-amber-200'
                              : 'bg-slate-800/70 border-white/10 text-slate-400'
                        }`}
                      >
                        <span className="flex items-center gap-1 font-display text-[11px] font-extrabold leading-tight">
                          {passed && <Check className="h-3 w-3 shrink-0" />}
                          {st.shortName}
                        </span>
                        <span className="mt-0.5 font-mono-num text-[10px]">
                          {st.totalPlayers}→{st.qualifyCount}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {nextStage && (
                  <p className="mt-2 text-xs font-bold text-amber-300">
                    Siguiente fase: {nextStage.name} ({nextStage.totalPlayers} jugadores →{' '}
                    {nextStage.isFinal ? '¡Ganador!' : `${nextStage.qualifyCount} clasifican`})
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onNextRound}
              className="arcade-btn mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-6 py-3.5 font-display text-lg font-extrabold text-slate-950 border-b-4 border-amber-600 cursor-pointer"
            >
              <span>
                {nextStage ? `Ir a ${nextStage.name}` : 'Siguiente Ronda'}
              </span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {hud.phase === 'eliminated' && (
          <div className="pointer-events-auto w-full max-w-md rounded-3xl bg-slate-950/92 p-7 text-center text-white border-2 border-rose-500/60 shadow-2xl">
            <div className="font-display text-4xl font-extrabold text-rose-400">
              ¡ELIMINADO!
            </div>
            <p className="mt-2 text-sm text-slate-300">
              {hud.isTournament ? `Caíste en ${hud.stageName}. ` : ''}
              {hud.winnerName
                ? `Ganador de la ronda: ${hud.winnerName}`
                : 'No lograste clasificar a tiempo en esta ronda.'}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onPlayAgain}
                className="arcade-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-3 font-display text-base font-extrabold text-slate-950 border-b-4 border-amber-600 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reintentar</span>
              </button>
              <button
                type="button"
                onClick={onExitToLobby}
                className="arcade-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 font-display text-base font-bold text-white border-b-4 border-slate-950 cursor-pointer"
              >
                <span>Ir al Lobby</span>
              </button>
            </div>
          </div>
        )}

        {hud.phase === 'victory' && (
          <div className="pointer-events-auto w-full max-w-lg rounded-3xl bg-slate-950/94 p-6 sm:p-8 text-center text-white border-2 border-amber-400 shadow-2xl">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-lg">
              <Crown className="h-9 w-9" />
            </div>
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-amber-300">
              {hud.tournamentReward ? '¡CAMPEÓN DEL TORNEO!' : '¡VICTORIA!'}
            </div>

            <div className="mt-2 flex items-center justify-center gap-2 font-display text-lg font-extrabold text-white">
              {hasTournamentW && <WBadge color={wBadgeColor} size="md" />}
              <span>{playerName}</span>
            </div>

            {hud.tournamentReward ? (
              <div className="mt-4 space-y-3 text-left">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900/90 p-3 border border-emerald-400/40">
                    <Gem className="h-6 w-6 shrink-0 text-emerald-400 fill-emerald-400" />
                    <div>
                      <div className="font-mono-num text-lg font-extrabold text-emerald-300">
                        +{hud.tournamentReward.gems.toLocaleString('es-ES')}
                      </div>
                      <div className="text-[11px] font-bold text-slate-300">Gemas</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-2xl bg-slate-900/90 p-3 border border-fuchsia-400/40">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fuchsia-500 font-display text-xs font-extrabold text-white">
                      S
                    </span>
                    <div>
                      <div className="font-mono-num text-lg font-extrabold text-fuchsia-300">
                        +{hud.tournamentReward.tokens}
                      </div>
                      <div className="text-[11px] font-bold text-slate-300">Fichas</div>
                    </div>
                  </div>
                </div>

                {hud.tournamentReward.unlockedSkinName && (
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-amber-400/15 px-4 py-2.5 border border-amber-300/60">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-300 shrink-0" />
                      <div>
                        <div className="text-[11px] font-bold text-amber-200">
                          ¡SKIN DE CAMPEÓN DESBLOQUEADA!
                        </div>
                        <div className="font-display text-sm font-extrabold text-white">
                          {hud.tournamentReward.unlockedSkinName} ({hud.tournamentReward.unlockedSkinRarity})
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl bg-[#083b7f]/80 p-3.5 border border-sky-400/40">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-display text-xs font-extrabold text-amber-300">
                      {hud.tournamentReward.wBadgeUnlockedNow
                        ? '¡DESBLOQUEASTE LA W PERMANENTE EN TU NOMBRE!'
                        : 'ELIGE EL COLOR DE TU W PERMANENTE'}
                    </span>
                  </div>
                  <WColorSelector value={wBadgeColor} onChange={onChangeWColor} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold text-sky-100">
                ¡+1 Corona y +30 Trofeos! Has conquistado {hud.mapMeta.name}.
              </p>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={onPlayAgain}
                className="arcade-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-3 font-display text-base font-extrabold text-slate-950 border-b-4 border-amber-600 cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Jugar Otra Vez</span>
              </button>
              <button
                type="button"
                onClick={onExitToLobby}
                className="arcade-btn flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 font-display text-base font-bold text-white border-b-4 border-slate-950 cursor-pointer"
              >
                <span>Lobby</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: 0.56 Emote Action Bar + Desktop Controls Hint */}
      <div className="flex flex-col items-center gap-2">
        {hud.phase === 'playing' && !hud.playerQualified && !hud.playerEliminated && (
          hud.emotesEnabled ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-slate-950/88 px-2.5 py-2 border border-white/15 shadow-xl">
              {hud.emoteSlots.map((em, idx) => {
                const cd = hud.emoteCooldowns[em.id] || 0;
                const onCd = cd > 0.05;
                return (
                  <button
                    key={em.id + idx}
                    type="button"
                    disabled={onCd}
                    onClick={() => onTriggerEmote(idx)}
                    title={`${em.name} (Tecla ${idx + 1})`}
                    className={`relative flex h-12 w-12 sm:h-13 sm:w-13 flex-col items-center justify-center rounded-xl border-2 transition-transform ${
                      onCd
                        ? 'bg-slate-800/90 border-slate-700 opacity-65 cursor-not-allowed'
                        : 'bg-[#0e57b5] hover:bg-[#166ee0] border-white/30 hover:-translate-y-0.5 cursor-pointer'
                    }`}
                  >
                    <span className="text-xl sm:text-2xl leading-none">{em.icon}</span>
                    <span className="absolute -top-1.5 -left-1.5 flex h-4 w-4 items-center justify-center rounded bg-amber-400 font-mono-num text-[10px] font-extrabold text-slate-950">
                      {idx + 1}
                    </span>
                    {onCd && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/75 font-mono-num text-xs font-extrabold text-amber-300">
                        {cd.toFixed(1)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-950/80 px-3 py-1 text-[11px] font-bold text-rose-300 border border-rose-500/30">
              Emotes desactivados en esta sala
            </div>
          )
        )}

        <div className="hidden md:flex justify-center">
          <div className="rounded-xl bg-slate-950/80 px-4 py-1.5 text-xs font-semibold text-slate-200 border border-white/10">
            WASD / Flechas: Mover · Espacio: Saltar · Doble Espacio / Shift: Plancha · 1–4: Emotes · Arrastra: Cámara
          </div>
        </div>
      </div>
    </div>
  );
};
