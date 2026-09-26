import * as Tone from "tone";

/**
 * Lo-Fi Procedural Music & Reactive Audio Engine
 * Provides continuous relaxing lo-fi chords + reactive sound effects synced to the beat.
 */
export class LoFiAudioSystem {
    private isStarted = false;
    private isMuted = false;
    private initializing: Promise<void> | null = null;
    private fanfareTimeouts: Array<ReturnType<typeof setTimeout>> = [];

    // Instruments
    private pianoSynth!: Tone.PolySynth;
    private leadSynth!: Tone.PolySynth;
    private sfxSynth!: Tone.PolySynth;
    private filter!: Tone.Filter;
    private reverb!: Tone.Reverb;
    private chorus!: Tone.Chorus;
    private loFiLoop!: Tone.Loop;

    // Lo-Fi Jazz Chord Progression (Key of C / A Minor - Warm & Chill)
    private chords = [
        ["D3", "F3", "A3", "C4", "E4"], // Dm9
        ["G2", "F3", "B3", "E4"],       // G13
        ["C3", "E3", "G3", "B3", "D4"], // Cmaj9
        ["A2", "G3", "C4", "E4"]        // Am7
    ];
    private currentChordIndex = 0;

    // Country Pentatonic Scales
    private countryScaleMap: Record<string, string[]> = {
        "ID": ["C4", "D4", "E4", "G4", "A4", "C5"],
        "US": ["G4", "A4", "B4", "D5", "E5", "G5"],
        "JP": ["A4", "C5", "D5", "E5", "G5", "A5"],
        "KR": ["E4", "G4", "A4", "B4", "D5", "E5"],
        "BR": ["D4", "F4", "G4", "A4", "C5", "D5"],
        "FR": ["F4", "G4", "A4", "C5", "D5", "F5"],
        "DE": ["C4", "Eb4", "F4", "G4", "Bb4", "C5"],
        "GB": ["G4", "B4", "C5", "D5", "E5", "G5"]
    };

    constructor() {
        // Safe deferred initialization on user interaction / Tone.start()
    }

    public async initialize() {
        if (this.isStarted) return;
        // Guard against concurrent calls (e.g. rapid double-clicks) creating duplicate nodes.
        if (this.initializing) return this.initializing;

        this.initializing = (async () => {
            try {
                await Tone.start();

                // FX Chain for Warm Lo-Fi Aesthetic
                this.filter = new Tone.Filter({
                    frequency: 1600,
                    type: "lowpass",
                    rolloff: -12
                }).toDestination();

                this.reverb = new Tone.Reverb({
                    decay: 2.5,
                    preDelay: 0.05,
                    wet: 0.35
                }).connect(this.filter);

                this.chorus = new Tone.Chorus({
                    frequency: 1.5,
                    delayTime: 3.5,
                    depth: 0.6,
                    wet: 0.3
                }).connect(this.reverb);

                // Lo-Fi Electric Piano
                this.pianoSynth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "triangle" },
                    envelope: {
                        attack: 0.04,
                        decay: 1.2,
                        sustain: 0.3,
                        release: 1.4
                    }
                }).connect(this.chorus);
                this.pianoSynth.volume.value = -14;

                // Reactive Pentatonic Synth
                this.leadSynth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: "sine" },
                    envelope: {
                        attack: 0.02,
                        decay: 0.3,
                        sustain: 0.1,
                        release: 0.5
                    }
                }).connect(this.reverb);
                this.leadSynth.volume.value = -12;

                // Hit / Laser SFX Synth
                this.sfxSynth = new Tone.PolySynth(Tone.MembraneSynth).connect(this.reverb);
                this.sfxSynth.volume.value = -18;

                // Set Lo-Fi BPM
                Tone.getTransport().bpm.value = 76;

                // Background Lo-Fi Chords Loop (plays every 2 measures)
                this.loFiLoop = new Tone.Loop((time) => {
                    const chord = this.chords[this.currentChordIndex];
                    this.pianoSynth.triggerAttackRelease(chord, "2n", time);
                    this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
                }, "2m");

                this.loFiLoop.start(0);
                Tone.getTransport().start();

                this.isStarted = true;
                console.log("[LoFiAudio] Engine started with 76 BPM Lo-Fi stream ambiance.");
            } catch (e) {
                console.error("[LoFiAudio] Initialization error:", e);
            } finally {
                // Allow retry on failure; keep the (possibly partial) guard cleared either way.
                this.initializing = null;
            }
        })();

        return this.initializing;
    }

    public playSpawnNote(countryCode: string) {
        if (!this.isStarted || this.isMuted) return;
        const scale = this.countryScaleMap[countryCode] || ["C4", "E4", "G4", "A4", "C5"];
        const note = scale[Math.floor(Math.random() * scale.length)];
        this.leadSynth.triggerAttackRelease(note, "8n");
    }

    public playHitSound(countryCode: string) {
        if (!this.isStarted || this.isMuted) return;
        const scale = this.countryScaleMap[countryCode] || ["C5", "E5", "G5"];
        const note = scale[scale.length - 1]; // High resonant ping
        this.leadSynth.triggerAttackRelease(note, "16n");
        this.sfxSynth.triggerAttackRelease("C2", "16n");
    }

    public playWinnerFanfare() {
        if (!this.isStarted || this.isMuted) return;
        // Track timeouts so dispose()/mute can cancel a fanfare mid-flight
        // instead of firing into disposed synths.
        this.clearFanfare();
        const fanfare = ["C4", "E4", "G4", "C5", "E5"];
        fanfare.forEach((n, idx) => {
            this.fanfareTimeouts.push(
                setTimeout(() => {
                    if (!this.isStarted || this.isMuted) return;
                    this.leadSynth.triggerAttackRelease(n, "4n");
                }, idx * 120),
            );
        });
    }

    private clearFanfare() {
        for (const t of this.fanfareTimeouts) clearTimeout(t);
        this.fanfareTimeouts = [];
    }

    public toggleMute(): boolean {
        this.isMuted = !this.isMuted;
        if (this.isMuted) this.clearFanfare();
        if (this.filter) {
            Tone.getDestination().mute = this.isMuted;
        }
        return this.isMuted;
    }

    public isAudioRunning(): boolean {
        return this.isStarted && !this.isMuted;
    }

    public isMutedState(): boolean {
        return this.isMuted;
    }

    public isEngineStarted(): boolean {
        return this.isStarted;
    }

    public dispose() {
        this.clearFanfare();
        this.loFiLoop?.dispose();
        this.pianoSynth?.dispose();
        this.leadSynth?.dispose();
        this.sfxSynth?.dispose();
        this.filter?.dispose();
        this.reverb?.dispose();
        this.chorus?.dispose();
        Tone.getTransport().stop();
        this.isStarted = false;
        // Reset the mute latch too. This is a module singleton, so leaving
        // isMuted/Tone's destination muted here means the engine rebuilds
        // itself already-silent after a remount (React strict-mode double
        // mount in dev, or an OBS source reload).
        this.isMuted = false;
        Tone.getDestination().mute = false;
    }
}

export const audioSystem = new LoFiAudioSystem();
