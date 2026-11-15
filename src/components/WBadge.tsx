import React from 'react';
import { WBadgeColor } from '../game/types';

interface WBadgeProps {
  color: WBadgeColor;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  title?: string;
}

const SIZE_CLASSES: Record<NonNullable<WBadgeProps['size']>, string> = {
  xs: 'px-1.5 py-0.5 text-[11px] rounded',
  sm: 'px-1.5 py-0.5 text-xs rounded-md',
  md: 'px-2 py-0.5 text-sm rounded-lg',
  lg: 'px-2.5 py-1 text-lg rounded-xl',
};

const CONTAINER_CLASSES: Record<WBadgeColor, string> = {
  blue: 'bg-slate-950/90 border-sky-400 shadow-sky-500/30',
  red: 'bg-slate-950/90 border-rose-500 shadow-rose-500/30',
  rainbow: 'bg-slate-950/90 border-amber-300 shadow-amber-400/30',
};

const TEXT_CLASSES: Record<WBadgeColor, string> = {
  blue: 'text-sky-400',
  red: 'text-rose-500',
  rainbow: 'w-badge-rainbow bg-clip-text text-transparent',
};

export const WBadge: React.FC<WBadgeProps> = ({
  color,
  size = 'sm',
  title = 'Campeón de Torneo [W]',
}) => {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center justify-center font-display font-black tracking-tight border-2 shadow-md select-none leading-none ${SIZE_CLASSES[size]} ${CONTAINER_CLASSES[color]}`}
    >
      <span className={TEXT_CLASSES[color]}>[W]</span>
    </span>
  );
};

interface WColorSelectorProps {
  value: WBadgeColor;
  onChange: (color: WBadgeColor) => void;
  compact?: boolean;
}

export const WColorSelector: React.FC<WColorSelectorProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const options: Array<{ id: WBadgeColor; label: string }> = [
    { id: 'blue', label: 'Azul' },
    { id: 'red', label: 'Rojo' },
    { id: 'rainbow', label: 'Arcoíris' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`inline-flex items-center gap-1.5 rounded-xl border-2 font-display font-extrabold transition-colors cursor-pointer whitespace-nowrap ${
              compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
              active
                ? 'bg-amber-400 text-slate-950 border-amber-700 shadow'
                : 'bg-[#083b7f] text-white border-white/15 hover:bg-[#0d4899]'
            }`}
          >
            <WBadge color={opt.id} size="xs" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
