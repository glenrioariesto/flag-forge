"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import * as Colyseus from "colyseus.js";
import { Leaderboard } from "@/components/game/Leaderboard";
import { WinnerBanner } from "@/components/game/WinnerBanner";
import { FlagData, BulletData, LeaderboardData, RoundWinner } from "@/types/game";
import { ChatWindow } from "@/components/game/ChatWindow";
import { audioSystem } from "@/lib/audio";

// Dynamic import for Pixi stage to ensure 100% browser-only WebGL execution
const PixiStage = dynamic(() => import("@/components/game/PixiStage"), {
    ssr: false,
    loading: () => <div className="absolute inset-0 bg-transparent" />
});

export default function OverlayPage() {
    const [status, setStatus] = useState("Connecting...");
    const [flags, setFlags] = useState<FlagData[]>([]);
    const [bullets, setBullets] = useState<BulletData[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardData[]>([]);
    const [roundTimeLeft, setRoundTimeLeft] = useState(600);
    const [roundNumber, setRoundNumber] = useState(1);
    const [winnerBanner, setWinnerBanner] = useState<RoundWinner | null>(null);
    const [totalSpawns, setTotalSpawns] = useState(0);
    const [isAudioActive, setIsAudioActive] = useState(false);

    const [dimensions, setDimensions] = useState({ width: 1920, height: 1080 });
    const [mounted, setMounted] = useState(false);
    const [selectedFlag, setSelectedFlag] = useState<FlagData | null>(null);
    
    const roomRef = useRef<Colyseus.Room | null>(null);

    useEffect(() => {
        setMounted(true);
        setDimensions({ width: window.innerWidth, height: window.innerHeight });

        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener("resize", handleResize);

        // Auto start audio on user click anywhere
        const handleInteraction = async () => {
            await audioSystem.initialize();
            setIsAudioActive(audioSystem.isAudioRunning());
        };
        window.addEventListener("pointerdown", handleInteraction, { once: false });

        const connectToGame = async () => {
            try {
                const colyseusUrl =
                    process.env.NEXT_PUBLIC_COLYSEUS_URL || "ws://localhost:3001";
                const client = new Colyseus.Client(colyseusUrl);
                const room = await client.joinOrCreate("flag_room");
                roomRef.current = room;

                setStatus(`Live Engine Connected`);

                room.onMessage("state", (data) => {
                    setFlags(data.flags ?? []);
                    setBullets(data.bullets ?? []);
                    setLeaderboard(data.leaderboard ?? []);
                    if (typeof data.roundTimeLeft === "number") setRoundTimeLeft(data.roundTimeLeft);
                    if (typeof data.roundNumber === "number") setRoundNumber(data.roundNumber);
                    if (typeof data.totalSpawns === "number") setTotalSpawns(data.totalSpawns);
                    setWinnerBanner(data.winnerBanner ?? null);
                });

                room.onMessage("spawn", (data) => {
                    audioSystem.playSpawnNote(data.country);
                });

                room.onMessage("hit", (data) => {
                    audioSystem.playHitSound(data.country);
                });

                room.onMessage("round_winner", (data) => {
                    setWinnerBanner(data);
                    audioSystem.playWinnerFanfare();
                });
            } catch (err) {
                setStatus("Connection failed - Retrying in 5s...");
                console.error(err);
                setTimeout(connectToGame, 5000);
            }
        };

        connectToGame();

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("pointerdown", handleInteraction);
            roomRef.current?.leave();
            audioSystem.dispose();
        };
    }, []);

    const toggleAudio = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!audioSystem.isAudioRunning()) {
            await audioSystem.initialize();
            setIsAudioActive(true);
        } else {
            const isMuted = audioSystem.toggleMute();
            setIsAudioActive(!isMuted);
        }
    };

    if (!mounted) return null;

    const realPlayersCount = flags.filter(f => !f.isBot).length;
    const botCount = flags.filter(f => f.isBot).length;

    return (
        <div className="w-screen h-screen bg-transparent overflow-hidden text-white font-sans relative select-none">
            {/* Top Bar / Controls */}
            <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
                <div className="bg-slate-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-purple-500/20 text-xs font-mono text-slate-200 shadow-xl flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>{status}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-purple-300">👥 {realPlayersCount} Viewers</span>
                    <span className="text-slate-400">({botCount} Bots)</span>
                </div>

                {/* Audio Status & Mute Control */}
                <button 
                    onClick={toggleAudio}
                    className="bg-slate-950/80 hover:bg-slate-900 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-purple-500/20 text-xs font-mono text-slate-200 shadow-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Toggle Lo-Fi Procedural Audio"
                >
                    <span>{isAudioActive ? "🎵 Lo-Fi 76 BPM (Active)" : "🔇 Click to Enable Audio"}</span>
                </button>
            </div>

            {/* Leaderboard Overlay */}
            <div className="absolute top-4 right-4 z-50 transition-opacity duration-300">
                <Leaderboard 
                    data={leaderboard} 
                    roundTimeLeft={roundTimeLeft}
                    roundNumber={roundNumber}
                    totalSpawns={totalSpawns}
                />
            </div>

            {/* Bottom Stream Call-To-Action Banner */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-950/85 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-purple-500/30 shadow-[0_0_30px_rgba(168,85,247,0.15)] flex items-center gap-4">
                <span className="text-lg">💬</span>
                <div>
                    <span className="text-xs text-purple-300 font-bold uppercase tracking-wider block">Join The Battle</span>
                    <span className="text-sm font-medium text-slate-100">
                        Type your country code in live chat: <span className="font-mono font-bold text-amber-300 bg-white/10 px-1.5 py-0.5 rounded">ID</span> <span className="font-mono font-bold text-amber-300 bg-white/10 px-1.5 py-0.5 rounded">US</span> <span className="font-mono font-bold text-amber-300 bg-white/10 px-1.5 py-0.5 rounded">JP</span> <span className="font-mono font-bold text-amber-300 bg-white/10 px-1.5 py-0.5 rounded">BR</span>
                    </span>
                </div>
            </div>

            {/* Chat Window Details */}
            {selectedFlag && (
                <ChatWindow 
                    flag={selectedFlag} 
                    onClose={() => setSelectedFlag(null)} 
                />
            )}

            {/* Round Winner Celebration Modal */}
            <WinnerBanner winner={winnerBanner} />

            {/* PixiJS Game Stage (SSR-safe dynamic) */}
            <div className="absolute inset-0 z-0">
                <PixiStage 
                    width={dimensions.width}
                    height={dimensions.height}
                    flags={flags}
                    bullets={bullets}
                    onSelectFlag={setSelectedFlag}
                />
            </div>
        </div>
    );
}
