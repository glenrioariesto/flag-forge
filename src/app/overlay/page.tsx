"use client";

import { useEffect, useRef, useState } from "react";
import * as Colyseus from "colyseus.js";
import * as Tone from "tone";
import { Leaderboard } from "@/components/game/Leaderboard";
import { FlagData, BulletData, LeaderboardData } from "@/types/game";
import { Application } from "@pixi/react";
import { PixiFlag } from "@/components/game/PixiFlag";
import { PixiBullet } from "@/components/game/PixiBullet";
import { ChatWindow } from "@/components/game/ChatWindow";

export default function OverlayPage() {
    const [status, setStatus] = useState("Connecting...");
    const [flags, setFlags] = useState<FlagData[]>([]);
    const [bullets, setBullets] = useState<BulletData[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardData[]>([]);
    const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
    const [mounted, setMounted] = useState(false);
    const [selectedFlag, setSelectedFlag] = useState<FlagData | null>(null);
    
    const roomRef = useRef<Colyseus.Room | null>(null);
    const synthRef = useRef<Tone.PolySynth | null>(null);

    useEffect(() => {
        setMounted(true);
        // Initial dimension set
        setDimensions({ width: window.innerWidth, height: window.innerHeight });

        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener("resize", handleResize);

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
                    if (synthRef.current && Tone.context.state === "running") {
                        const notes = ["C4", "E4", "G4", "A4", "C5"];
                        const randomNote = notes[Math.floor(Math.random() * notes.length)];
                        synthRef.current.triggerAttackRelease(randomNote, "8n");
                    } else if (synthRef.current) {
                         Tone.start().catch(() => {});
                    }
                });
            } catch (err) {
                setStatus("Connection failed.");
                console.error(err);
            }
        };

        connectToGame();

        return () => {
            window.removeEventListener("resize", handleResize);
            roomRef.current?.leave();
            synthRef.current?.dispose();
        };
    }, []);

    if (!mounted) return null;

    return (
        <div className="w-screen h-screen bg-transparent overflow-hidden text-white font-sans relative">
            {/* Status Indicator */}
            <div
                className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 z-50 text-xs font-mono text-white/80 shadow-lg"
            >
                Status: {status}
            </div>

            {/* Leaderboard (HTML Overlay) */}
            <div className="absolute top-4 right-4 z-50 w-64 transition-opacity duration-300">
                <Leaderboard data={leaderboard} />
            </div>

            {/* Chat Window */}
            {selectedFlag && (
                <ChatWindow 
                    flag={selectedFlag} 
                    onClose={() => setSelectedFlag(null)} 
                />
            )}

            {/* PixiJS Game Stage */}
            <div className="absolute inset-0 z-0">
                <Application 
                    width={dimensions.width} 
                    height={dimensions.height} 
                    backgroundAlpha={0}
                    antialias={true}
                >
                    <pixiContainer>
                        {flags.map((flag) => (
                            <PixiFlag 
                                key={flag.id} 
                                flag={flag} 
                                screenWidth={dimensions.width}
                                screenHeight={dimensions.height}
                                onSelect={setSelectedFlag}
                            />
                        ))}
                        {bullets.map((bullet) => (
                            <PixiBullet 
                                key={bullet.id} 
                                bullet={bullet} 
                                screenWidth={dimensions.width}
                                screenHeight={dimensions.height}
                            />
                        ))}
                    </pixiContainer>
                </Application>
            </div>
        </div>
    );
}
