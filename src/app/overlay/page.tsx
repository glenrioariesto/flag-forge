"use client";

import { useEffect, useRef, useState } from "react";
import * as Colyseus from "colyseus.js";
import * as Tone from "tone";

type WeaponType = "cannon" | "laser" | "rocket";

type FlagItem = {
    id: string;
    country: string;
    x: number;
    y: number;
    weapon: WeaponType;
};

type BulletItem = {
    id: string;
    x: number;
    y: number;
    weapon: WeaponType;
};

type LeaderboardItem = {
    country: string;
    score: number;
};

export default function OverlayPage() {
    const [status, setStatus] = useState("Connecting...");
    const [flags, setFlags] = useState<FlagItem[]>([]);
    const [bullets, setBullets] = useState<BulletItem[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
    const roomRef = useRef<Colyseus.Room | null>(null);
    const synthRef = useRef<Tone.PolySynth | null>(null);

    useEffect(() => {
        synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();

        const connectToGame = async () => {
            try {
                const client = new Colyseus.Client("ws://localhost:3001");
                const room = await client.joinOrCreate("flag_room");
                roomRef.current = room;

                setStatus(`Connected (Session: ${room.sessionId})`);

                room.onMessage("state", (data) => {
                    setFlags(data.flags ?? []);
                    setBullets(data.bullets ?? []);
                    setLeaderboard(data.leaderboard ?? []);
                });

                room.onMessage("spawn", () => {
                    if (synthRef.current) {
                        Tone.start();
                        const notes = ["C4", "E4", "G4", "A4", "C5"];
                        const randomNote = notes[Math.floor(Math.random() * notes.length)];
                        synthRef.current.triggerAttackRelease(randomNote, "8n");
                    }
                });
            } catch (err) {
                setStatus("Connection failed.");
                console.error(err);
            }
        };

        connectToGame();

        return () => {
            roomRef.current?.leave();
            synthRef.current?.dispose();
        };
    }, []);

    const weaponIcon = (weapon: WeaponType) => {
        if (weapon === "laser") return "🔫";
        if (weapon === "rocket") return "🚀";
        return "💣";
    };

    return (
        <div className="w-screen h-screen bg-transparent overflow-hidden text-white font-sans">
            <div
                className="absolute top-3 left-3 bg-black/60 px-3 py-2 rounded z-50"
                style={{ fontSize: "clamp(12px, 1.6vw, 16px)" }}
            >
                Status: {status}
            </div>
            <div
                className="absolute top-3 right-3 bg-black/60 px-3 py-2 rounded z-50 w-[clamp(140px,22vw,280px)]"
                style={{ fontSize: "clamp(12px, 1.6vw, 16px)" }}
            >
                <div className="font-semibold mb-2">Leaderboard</div>
                <div className="space-y-1">
                    {leaderboard.length === 0 && <div className="opacity-70">Belum ada skor</div>}
                    {leaderboard.map((item) => (
                        <div key={item.country} className="flex items-center justify-between">
                            <span>{item.country}</span>
                            <span className="tabular-nums">{item.score}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="absolute inset-0 z-0 pointer-events-none">
                {flags.map((flag) => (
                    <div
                        key={flag.id}
                        className="absolute shadow-lg border-2 border-white/80 rounded bg-black/40 px-2 py-1"
                        style={{
                            left: `${flag.x}%`,
                            top: `${flag.y}%`
                        }}
                    >
                        <div className="flex items-center gap-2" style={{ fontSize: "clamp(14px, 2.2vw, 24px)" }}>
                            <span>{flag.country}</span>
                            <span style={{ fontSize: "clamp(16px, 2.4vw, 26px)" }}>{weaponIcon(flag.weapon)}</span>
                        </div>
                    </div>
                ))}
            </div>
            <div className="absolute inset-0 z-10 pointer-events-none">
                {bullets.map((bullet) => (
                    <div
                        key={bullet.id}
                        className="absolute"
                        style={{
                            left: `${bullet.x}%`,
                            top: `${bullet.y}%`,
                            fontSize: "clamp(12px, 1.6vw, 20px)"
                        }}
                    >
                        {weaponIcon(bullet.weapon)}
                    </div>
                ))}
            </div>
        </div>
    );
}
