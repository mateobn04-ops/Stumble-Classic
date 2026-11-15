export class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private sfxEnabled = true;
  private musicEnabled = true;

  private musicTimer: number | null = null;
  private musicStep = 0;
  private lastEventTimes = new Map<string, number>();

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxEnabled ? 0.9 : 0;
      this.sfxGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled ? 0.65 : 0;
      this.musicGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private canTrigger(key: string, minIntervalMs: number): boolean {
    const now = performance.now();
    const prev = this.lastEventTimes.get(key) || 0;
    if (now - prev < minIntervalMs) return false;
    this.lastEventTimes.set(key, now);
    return true;
  }

  private getSfxOut(): { ctx: AudioContext; out: GainNode } | null {
    if (this.muted || !this.sfxEnabled) return null;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return null;
    return { ctx, out: this.sfxGain };
  }

  public unlock(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stopMusic();
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(enabled ? 0.9 : 0, this.ctx.currentTime);
    }
  }

  public isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setValueAtTime(enabled ? 0.65 : 0, this.ctx.currentTime);
    }
    if (!enabled) {
      this.stopMusic();
    }
  }

  public isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  // ===========================================================================
  // MOVEMENT, JUMPS & LANDINGS
  // ===========================================================================
  public playJump(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('jump', 60)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(230, now);
    osc.frequency.exponentialRampToValueAtTime(590, now + 0.13);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playLand(impactSpeed = 8): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('land', 90)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const vol = Math.min(0.16, Math.max(0.04, impactSpeed * 0.01));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.075);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playDive(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('dive', 120)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Air whoosh noise
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + 0.18);
      filter.Q.value = 1.6;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.16, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(out);
      noise.start(now);
      noise.stop(now + 0.2);
    }

    // Swoop synth
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.17);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  // ===========================================================================
  // COLLISIONS & IMPACTS
  // ===========================================================================
  public playHit(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('hit', 140)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    // Heavy bass bonk
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.2);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.23);

    // Impact transient crunch
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(950, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.2, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(out);
      noise.start(now);
      noise.stop(now + 0.13);
    }
  }

  public playBump(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('bump', 160)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(195, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playBounce(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('bounce', 100)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(270, now);
    osc.frequency.exponentialRampToValueAtTime(890, now + 0.18);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playTileCrack(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('crack', 90)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(640, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.065);
    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // ===========================================================================
  // FALLS & RESPAWNS
  // ===========================================================================
  public playFall(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('fall', 700)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(165, now + 0.45);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  public playRespawn(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('respawn', 250)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    [392, 523.25].forEach((freq, idx) => {
      const t = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  // ===========================================================================
  // MATCH FLOW & REWARDS
  // ===========================================================================
  public playCountdown(finalGo: boolean): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(finalGo ? 880 : 523.25, now);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (finalGo ? 0.36 : 0.18));
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + (finalGo ? 0.37 : 0.19));
  }

  public playQualify(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  public playEliminate(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const notes = [392, 349.23, 293.66, 220];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  public playCrown(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.44);
    });
  }

  public playCoin(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const notes = [987.77, 1318.51];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.24);
    });
  }

  public playUnlock(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.34);
    });
  }

  public playLevelUp(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.connect(gain);
      gain.connect(out);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  public playSpinTick(): void {
    const audio = this.getSfxOut();
    if (!audio) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(920, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playButtonClick(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('click', 45)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.045);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  // ===========================================================================
  // 0.56 EMOTES, SPECIAL ABILITIES & LASER HAZARDS
  // ===========================================================================
  public playEmotePop(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('emote_pop', 120)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.08);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playPunch(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('punch', 150)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.18);
    gain.gain.setValueAtTime(0.26, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.21);
  }

  public playKick(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('kick', 150)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  public playHug(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('hug', 180)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    [440, 587.33].forEach((freq, i) => {
      const t = now + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playBanana(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('banana', 150)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playSlip(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('slip', 200)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.14);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.28);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  public playBall(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('ball', 140)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playLightning(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('lightning', 180)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playInvis(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('invis', 200)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    [660, 880, 1174].forEach((freq, i) => {
      const t = now + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playShield(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('shield', 200)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(720, now + 0.2);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  public playLaser(): void {
    const audio = this.getSfxOut();
    if (!audio || !this.canTrigger('laser', 180)) return;
    const { ctx, out } = audio;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.2);
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(out);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  // ===========================================================================
  // UPBEAT ARCADE BACKGROUND LOOP
  // ===========================================================================
  public startMusic(): void {
    if (this.muted || !this.musicEnabled || this.musicTimer !== null) return;
    const melody = [
      523.25, 0, 659.25, 587.33, 523.25, 0, 392.0, 440.0,
      523.25, 659.25, 783.99, 0, 659.25, 587.33, 523.25, 0,
    ];
    const bass = [
      130.81, 0, 196.0, 0, 146.83, 0, 196.0, 0,
      164.81, 0, 196.0, 0, 130.81, 0, 196.0, 0,
    ];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.musicEnabled) return;
      const ctx = this.ensureContext();
      if (!ctx || !this.musicGain) return;
      const idx = this.musicStep % melody.length;
      this.musicStep++;
      const now = ctx.currentTime;
      const mFreq = melody[idx];
      if (mFreq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(mFreq, now);
        gain.gain.setValueAtTime(0.045, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.15);
      }
      const bFreq = bass[idx];
      if (bFreq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(bFreq, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.17);
      }
    }, 175);
  }

  public stopMusic(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const soundManager = new SoundEngine();
