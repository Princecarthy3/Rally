"use client";

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.8;

  private bgmInterval: ReturnType<typeof setTimeout> | null = null;
  private bgmPlaying: boolean = false;
  private bgmStep: number = 0;
  private bgmTheme: string = "lobby";

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private lastSkidTime: number = 0;

  constructor() {
    if (typeof window !== "undefined") {
      this.isMuted = localStorage.getItem("rally_muted") === "true";

      const savedVol = localStorage.getItem("rally_volume");

      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);

        if (!isNaN(parsed)) {
          this.volume = Math.max(0, Math.min(1, parsed));
        }
      }
    }
  }

  // =========================================================
  // AUDIO CONTEXT
  // =========================================================

  private initCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (
          window as unknown as {
            webkitAudioContext: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    return this.ctx;
  }

  // =========================================================
  // MUTE
  // =========================================================

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "rally_muted",
        String(this.isMuted)
      );
    }

    if (this.isMuted) {
      this.stopBgm();
    } else {
      this.startBgm(this.bgmTheme || "lobby");
    }

    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // =========================================================
  // VOLUME
  // =========================================================

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));

    if (typeof window !== "undefined") {
      localStorage.setItem(
        "rally_volume",
        String(this.volume)
      );
    }
  }

  // =========================================================
  // WIN SOUND
  // =========================================================

  public playWinSound() {
    if (this.isMuted) return;

    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    const notes = [
      523.25,  // C5
      659.25,  // E5
      783.99,  // G5
      1046.5,  // C6
      1318.5   // E6
    ];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(
        0.32 * this.volume,
        start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + 0.45
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  // =========================================================
  // LOSE SOUND
  // =========================================================

  public playLoseSound() {
    if (this.isMuted) return;

    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    const notes = [
      392.0,
      349.23,
      329.63,
      261.63
    ];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.15;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(
        0.25 * this.volume,
        start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + 0.35
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.35);
    });
  }

  // =========================================================
  // DRAW SOUND
  // =========================================================

  public playDrawSound() {
    if (this.isMuted) return;

    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    const notes = [
      440.0,
      523.25,
      440.0
    ];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.13;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(
        0.25 * this.volume,
        start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.001,
        start + 0.3
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  // =========================================================
  // CLICK SOUND
  // =========================================================

  public playClickSound() {
    if (this.isMuted) return;

    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";

    osc.frequency.setValueAtTime(
      700,
      now
    );

    osc.frequency.exponentialRampToValueAtTime(
      250,
      now + 0.06
    );

    gain.gain.setValueAtTime(
      0.2 * this.volume,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      now + 0.06
    );

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // =========================================================
  // MESSAGE / NOTIFICATION SOUND
  // =========================================================

  public playMessageSound() {
    if (this.isMuted) return;

    const ctx = this.initCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [880, 1318.5]; // Bright A5 -> E6 double chime pop

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.28 * this.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  // =========================================================
  // LUDO / BOARD GAME SFX
  // =========================================================

  /** Dice tumbling while in the air */
  public playDiceRollSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180 + Math.random() * 220, now + i * 0.045);
      gain.gain.setValueAtTime(0.0001, now + i * 0.045);
      gain.gain.linearRampToValueAtTime(0.12 * this.volume, now + i * 0.045 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.06);
    }
    // Soft land click
    const click = ctx.createOscillator();
    const cg = ctx.createGain();
    click.type = "square";
    click.frequency.setValueAtTime(420, now + 0.32);
    cg.gain.setValueAtTime(0.14 * this.volume, now + 0.32);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    click.connect(cg);
    cg.connect(ctx.destination);
    click.start(now + 0.32);
    click.stop(now + 0.42);
  }

  /** Token slides along the track */
  public playTokenMoveSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(420, now + 0.12);
    gain.gain.setValueAtTime(0.1 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Token leaves the home yard */
  public playTokenExitHomeSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392, 494, 587];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.07);
      gain.gain.setValueAtTime(0.12 * this.volume, now + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.07);
      osc.stop(now + i * 0.07 + 0.15);
    });
  }

  /** Opponent token sent back home */
  public playTokenCaptureSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.22);
    gain.gain.setValueAtTime(0.14 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Token finishes into the centre home */
  public playTokenFinishSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523, 659, 784].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.11 * this.volume, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.22);
    });
  }


  // =========================================================
  // BGM
  // Catchy Rally Arcade Groove
  // =========================================================

  public startLobbyBgm() {
    this.startBgm("lobby");
  }

  public startGameBgm(gameType: string) {
    const map: Record<string, string> = {
      ludo: "ludo",
      skribbl: "skribbl",
      memory_match: "memory",
      mini_golf: "golf",
      uno: "uno",
      rps: "battle",
      number_guess: "memory",
      battleship: "battle",
      tic_tac_toe: "battle",
      connect_four: "battle",
      dots_boxes: "golf",
    };
    this.startBgm(map[gameType] || "battle");
  }

  public startBgm(theme: string = "lobby") {
    if (this.bgmPlaying && this.bgmTheme === theme) return;
    this.stopBgm();
    this.bgmTheme = theme;
    this._startBgmInternal(theme);
  }

  private _startBgmInternal(theme: string) {
    if (this.isMuted) return;

    const ctx = this.initCtx();
    if (!ctx) return;

    this.bgmPlaying = true;
    this.bgmStep = 0;

    // Theme-specific progressions so lobby vs each game feel distinct
    const themed: Record<string, { chords: number[][]; melody: (number | null)[]; tempo: number }> = {
      lobby: {
        tempo: 0.28,
        chords: [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]],
        melody: [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 783.99, 987.77, 880.0, 783.99, 659.25, 523.25, 587.33, 659.25, 523.25, null],
      },
      ludo: {
        tempo: 0.32,
        chords: [[293.66, 369.99, 440.0], [246.94, 311.13, 369.99], [261.63, 329.63, 392.0], [220.0, 277.18, 329.63]],
        melody: [587.33, 659.25, 587.33, 493.88, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 493.88, 523.25, 587.33, null, null],
      },
      skribbl: {
        tempo: 0.26,
        chords: [[349.23, 440.0, 523.25], [293.66, 369.99, 440.0], [329.63, 415.3, 493.88], [261.63, 329.63, 392.0]],
        melody: [698.46, 783.99, 880.0, 783.99, 698.46, 659.25, 587.33, 659.25, 698.46, 783.99, 880.0, null, 783.99, 698.46, 659.25, null],
      },
      memory: {
        tempo: 0.3,
        chords: [[220.0, 277.18, 329.63], [246.94, 311.13, 369.99], [196.0, 246.94, 293.66], [174.61, 220.0, 261.63]],
        melody: [440.0, 493.88, 523.25, 493.88, 440.0, 392.0, 349.23, 392.0, 440.0, 523.25, 493.88, 440.0, null, 392.0, 440.0, null],
      },
      golf: {
        tempo: 0.34,
        chords: [[196.0, 246.94, 293.66], [174.61, 220.0, 261.63], [220.0, 277.18, 329.63], [164.81, 207.65, 246.94]],
        melody: [392.0, 440.0, 493.88, 523.25, 493.88, 440.0, 392.0, null, 349.23, 392.0, 440.0, 392.0, 349.23, 329.63, null, null],
      },
      uno: {
        tempo: 0.24,
        chords: [[329.63, 415.3, 493.88], [293.66, 369.99, 440.0], [349.23, 440.0, 523.25], [261.63, 329.63, 392.0]],
        melody: [659.25, 783.99, 659.25, 587.33, 659.25, 783.99, 987.77, 880.0, 783.99, 659.25, 587.33, 523.25, 587.33, 659.25, null, null],
      },
      battle: {
        tempo: 0.27,
        chords: [[246.94, 311.13, 369.99], [220.0, 277.18, 329.63], [196.0, 246.94, 293.66], [233.08, 293.66, 349.23]],
        melody: [493.88, 587.33, 698.46, 587.33, 493.88, 440.0, 493.88, 587.33, 698.46, 783.99, 698.46, 587.33, 493.88, null, 440.0, null],
      },
    };

    const pack = themed[theme] || themed.lobby;
    const chords = pack.chords;
    const melody = pack.melody;

    const playBeat = () => {
      if (
        this.isMuted ||
        !this.bgmPlaying ||
        !this.ctx
      ) {
        return;
      }

      const now = this.ctx.currentTime;

      /*
        110 BPM

        One beat ≈ 545ms
        Eighth note ≈ 272ms
      */

      const beatDuration = pack.tempo;

      const step = this.bgmStep;

      // Current chord
      const chord =
        chords[
          Math.floor(step / 8) % chords.length
        ];

      // =====================================================
      // BASS
      // =====================================================

      const bassFreq = chord[0] / 2;

      const bass = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();

      bass.type = "triangle";

      bass.frequency.setValueAtTime(
        bassFreq,
        now
      );

      bassGain.gain.setValueAtTime(
        0.09 * this.volume,
        now
      );

      bassGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + beatDuration * 1.7
      );

      bass.connect(bassGain);
      bassGain.connect(this.ctx.destination);

      bass.start(now);
      bass.stop(
        now + beatDuration * 1.7
      );

      // =====================================================
      // CHORD / PAD
      // =====================================================

      if (step % 2 === 0) {
        chord.forEach((freq, index) => {
          const osc =
            this.ctx!.createOscillator();

          const gain =
            this.ctx!.createGain();

          osc.type = "sine";

          osc.frequency.setValueAtTime(
            freq,
            now
          );

          gain.gain.setValueAtTime(
            0.045 * this.volume,
            now
          );

          gain.gain.linearRampToValueAtTime(
            0.075 * this.volume,
            now + 0.08
          );

          gain.gain.exponentialRampToValueAtTime(
            0.001,
            now + 0.52
          );

          osc.connect(gain);
          gain.connect(
            this.ctx!.destination
          );

          osc.start(now);
          osc.stop(now + 0.55);
        });
      }

      // =====================================================
      // CATCHY LEAD
      // =====================================================

      const melodyIndex =
        step % melody.length;

      const melodyFreq =
        melody[melodyIndex];

      if (melodyFreq) {
        const lead =
          this.ctx.createOscillator();

        const leadGain =
          this.ctx.createGain();

        lead.type = "square";

        lead.frequency.setValueAtTime(
          melodyFreq,
          now
        );

        leadGain.gain.setValueAtTime(
          0.075 * this.volume,
          now
        );

        leadGain.gain.exponentialRampToValueAtTime(
          0.001,
          now + 0.22
        );

        lead.connect(leadGain);
        leadGain.connect(
          this.ctx.destination
        );

        lead.start(now);
        lead.stop(now + 0.25);
      }

      // =====================================================
      // SOFT ARPEGGIO
      // =====================================================

      const arpFreq =
        chord[(step + 1) % chord.length] * 2;

      const arp =
        this.ctx.createOscillator();

      const arpGain =
        this.ctx.createGain();

      arp.type = "triangle";

      arp.frequency.setValueAtTime(
        arpFreq,
        now
      );

      arpGain.gain.setValueAtTime(
        0.045 * this.volume,
        now
      );

      arpGain.gain.exponentialRampToValueAtTime(
        0.001,
        now + 0.18
      );

      arp.connect(arpGain);
      arpGain.connect(
        this.ctx.destination
      );

      arp.start(now);
      arp.stop(now + 0.2);

      // =====================================================
      // ELECTRONIC KICK
      // =====================================================

      if (step % 4 === 0) {
        const kick =
          this.ctx.createOscillator();

        const kickGain =
          this.ctx.createGain();

        kick.type = "sine";

        kick.frequency.setValueAtTime(
          130,
          now
        );

        kick.frequency.exponentialRampToValueAtTime(
          55,
          now + 0.12
        );

        kickGain.gain.setValueAtTime(
          0.12 * this.volume,
          now
        );

        kickGain.gain.exponentialRampToValueAtTime(
          0.001,
          now + 0.14
        );

        kick.connect(kickGain);
        kickGain.connect(
          this.ctx.destination
        );

        kick.start(now);
        kick.stop(now + 0.15);
      }

      // =====================================================
      // HI-HAT
      // =====================================================

      if (step % 2 === 1) {
        const hat =
          this.ctx.createOscillator();

        const hatGain =
          this.ctx.createGain();

        hat.type = "square";

        hat.frequency.setValueAtTime(
          5000,
          now
        );

        hatGain.gain.setValueAtTime(
          0.018 * this.volume,
          now
        );

        hatGain.gain.exponentialRampToValueAtTime(
          0.001,
          now + 0.045
        );

        hat.connect(hatGain);
        hatGain.connect(
          this.ctx.destination
        );

        hat.start(now);
        hat.stop(now + 0.05);
      }

      this.bgmStep++;

      /*
        Schedule the next beat.
      */

      this.bgmInterval = setTimeout(
        playBeat,
        beatDuration * 1000
      );
    };

    playBeat();
  }

  // =========================================================
  // RALLY RACING SOUNDS
  // =========================================================

  public playEngineSound(rpmRatio: number) {
    if (this.isMuted) {
      this.stopEngineSound();
      return;
    }
    const ctx = this.initCtx();
    if (!ctx) return;

    const baseFreq = 65; // Idle rumble Hz
    const targetFreq = baseFreq + Math.max(0, Math.min(1, rpmRatio)) * 280;

    if (!this.engineOsc || !this.engineGain) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(targetFreq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08 * this.volume, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this.engineOsc = osc;
      this.engineGain = gain;
    } else {
      this.engineOsc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.05);
      this.engineGain.gain.setTargetAtTime(0.08 * this.volume, ctx.currentTime, 0.05);
    }
  }

  public stopEngineSound() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  public playCountdownBeep(isGo: boolean) {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isGo ? "triangle" : "sine";
    const freq = isGo ? 880 : 440;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.35 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.6 : 0.25));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isGo ? 0.6 : 0.25));
  }

  public playSkidSound() {
    if (this.isMuted) return;
    const now = Date.now();
    if (now - this.lastSkidTime < 180) return;
    this.lastSkidTime = now;

    const ctx = this.initCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(120, t + 0.15);

    gain.gain.setValueAtTime(0.12 * this.volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  public playCheckpointSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [587.33, 880.0];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.25 * this.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  public playFinishSound() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.35 * this.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  }

  // =========================================================
  // STOP BGM
  // =========================================================

  public stopBgm() {
    this.stopEngineSound();
    this.bgmPlaying = false;

    if (this.bgmInterval) {
      clearTimeout(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const sounds = new SoundManager();
