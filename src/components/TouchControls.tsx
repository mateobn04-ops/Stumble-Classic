import React, { useRef, useState } from 'react';

interface TouchControlsProps {
  onMove: (x: number, y: number) => void;
  onJump: () => void;
  onDive: () => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMove,
  onJump,
  onDive,
}) => {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const updateStick = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 14;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / maxR, dy / maxR);
  };

  const resetStick = () => {
    activePointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex items-end justify-between px-6 md:hidden">
      {/* Left Virtual Joystick */}
      <div
        ref={padRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          activePointerId.current = e.pointerId;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (activePointerId.current === e.pointerId) {
            updateStick(e.clientX, e.clientY);
          }
        }}
        onPointerUp={(e) => {
          if (activePointerId.current === e.pointerId) resetStick();
        }}
        onPointerCancel={resetStick}
        className="pointer-events-auto relative h-28 w-28 rounded-full bg-slate-950/60 border-2 border-white/30 flex items-center justify-center touch-none"
      >
        <div
          className="h-12 w-12 rounded-full bg-white/90 shadow-lg"
          style={{
            transform: `translate(${knob.x}px, ${knob.y}px)`,
          }}
        />
      </div>

      {/* Right Action Buttons: Dive & Jump */}
      <div className="pointer-events-auto flex items-center gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onDive();
          }}
          className="h-16 w-16 rounded-full bg-sky-500 active:bg-sky-400 text-white font-display text-xs font-extrabold border-b-4 border-sky-700 shadow-xl"
        >
          PLANCHA
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onJump();
          }}
          className="h-20 w-20 rounded-full bg-amber-400 active:bg-amber-300 text-slate-950 font-display text-sm font-extrabold border-b-4 border-amber-600 shadow-xl"
        >
          SALTAR
        </button>
      </div>
    </div>
  );
};
