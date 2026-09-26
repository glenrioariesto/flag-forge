import { LeaderboardData } from "@/types/game";

interface LeaderboardProps {
    data: LeaderboardData[];
    roundTimeLeft?: number;
    roundNumber?: number;
    totalSpawns?: number;
}

export const Leaderboard = ({ data, roundTimeLeft = 600, roundNumber = 1, totalSpawns = 0 }: LeaderboardProps) => {
    const minutes = Math.floor(roundTimeLeft / 60);
    const seconds = roundTimeLeft % 60;
    const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

    return (
        <div className="bg-slate-950/80 backdrop-blur-md border border-purple-500/20 rounded-2xl p-4 w-72 shadow-2xl text-white select-none">
            {/* Round Status Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
                <div>
                    <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold block">
                        Round {roundNumber}
                    </span>
                    <h3 className="text-white font-bold text-base flex items-center gap-1.5">
                        <span>🏆</span> Leaderboard
                    </h3>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-slate-400 block font-mono">Time Left</span>
                    <span className={`font-mono font-bold text-sm ${roundTimeLeft < 30 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                        ⏱️ {timeFormatted}
                    </span>
                </div>
            </div>

            {/* Score Ranks */}
            <div className="space-y-1.5 max-h-64 overflow-hidden">
                {data.length === 0 && (
                    <div className="text-white/40 text-xs text-center py-4 italic">
                        No scores yet. Spawn flags from chat!
                    </div>
                )}
                {data.map((item, index) => {
                    const isTop1 = index === 0;
                    const isTop2 = index === 1;
                    const isTop3 = index === 2;

                    return (
                        <div 
                            key={item.country} 
                            className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-all ${
                                isTop1 ? 'bg-amber-500/20 border border-amber-500/40 shadow-sm' :
                                isTop2 ? 'bg-slate-400/15 border border-slate-400/30' :
                                isTop3 ? 'bg-amber-700/20 border border-amber-700/30' :
                                'bg-white/5 border border-white/5 hover:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-2.5">
                                <span className={`
                                    w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black
                                    ${isTop1 ? 'bg-amber-400 text-black shadow-sm' : 
                                      isTop2 ? 'bg-slate-300 text-black' : 
                                      isTop3 ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-300'}
                                `}>
                                    {index + 1}
                                </span>
                                <span className="font-semibold text-xs text-slate-100 tracking-wide">
                                    {item.country}
                                </span>
                            </div>
                            <span className="font-mono font-bold text-xs text-amber-300">
                                {item.score} <span className="text-[9px] text-slate-400 font-normal">pts</span>
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Total Spawns Footer */}
            <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                <span>Total Spawns</span>
                <span className="font-mono font-medium text-slate-300">{totalSpawns}</span>
            </div>
        </div>
    );
};
