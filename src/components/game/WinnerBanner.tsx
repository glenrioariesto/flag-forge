import { RoundWinner } from "@/types/game";

interface WinnerBannerProps {
    winner: RoundWinner | null;
}

export const WinnerBanner = ({ winner }: WinnerBannerProps) => {
    if (!winner) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in pointer-events-none">
            <div className="bg-gradient-to-b from-amber-500/20 via-slate-900/90 to-purple-900/30 border-2 border-amber-400/80 rounded-3xl p-8 max-w-md w-full mx-4 text-center shadow-[0_0_50px_rgba(245,158,11,0.5)] transform scale-105 transition-all">
                <div className="text-4xl mb-2 animate-bounce">👑 🏆 👑</div>
                <h4 className="text-amber-400 font-extrabold text-sm uppercase tracking-widest mb-1">
                    Round Champion
                </h4>
                <h2 className="text-white font-black text-4xl tracking-wider mb-2">
                    {winner.country}
                </h2>
                <p className="text-slate-300 text-sm font-medium mb-4">
                    Finished with a score of <span className="font-mono font-bold text-amber-300 text-lg">{winner.score} pts</span>
                </p>
                <div className="inline-block bg-white/10 px-4 py-1.5 rounded-full text-xs text-purple-300 font-mono">
                    Next round starting in a few seconds...
                </div>
            </div>
        </div>
    );
};
