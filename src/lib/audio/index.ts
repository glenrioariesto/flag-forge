import * as Tone from "tone";

/**
 * Audio Mapping System
 * Maps countries to specific musical scales and instruments
 */
export class AudioSystem {
    private baseSynth: Tone.PolySynth;
    private isStarted = false;

    private noteMap: Record<string, string[]> = {
        // Pentatonic scale starting points
        "ID": ["C4", "E4", "G4", "A4"],
        "US": ["G4", "B4", "D5", "E5"],
        "JP": ["A4", "C5", "E5", "G5"],
        "BR": ["D4", "F4", "A4", "C5"],
        "FR": ["E4", "G4", "B4", "D5"],
        "DE": ["F4", "A4", "C5", "E5"],
        "KR": ["B3", "D4", "F#4", "A4"]
    };

    constructor() {
        this.baseSynth = new Tone.PolySynth(Tone.Synth).toDestination();
        // Configure default volumes
        this.baseSynth.volume.value = -12;
    }

    public async initialize() {
        if (this.isStarted) return;
        await Tone.start();
        this.isStarted = true;
        console.log("[AudioSystem] Tone.js Audio Context started");
    }

    public playCountryNote(countryCode: string) {
        if (!this.isStarted) return;

        // Fallback to random C major note if country not in map
        const notes = this.noteMap[countryCode] || ["C4", "E4", "G4", "C5"];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];

        this.baseSynth.triggerAttackRelease(randomNote, "8n");
    }

    public dispose() {
        this.baseSynth.dispose();
    }
}

// Singleton export
export const audioSystem = new AudioSystem();
