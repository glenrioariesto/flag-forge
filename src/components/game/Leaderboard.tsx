import { LeaderboardData } from "@/types/game";

interface LeaderboardProps {
    data: LeaderboardData[];
}

export const Leaderboard = ({ data }: LeaderboardProps) => {
    return (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 w-full shadow-xl">
            <h3 className="text-white font-bold text-lg mb-3 border-b border-white/10 pb-2 flex items-center gap-2">
                🏆 Leaderboard
            </h3>
            <div className="space-y-2">
                {data.length === 0 && (
                    <div className="text-white/50 text-sm text-center py-2">
                        Waiting for players...
                    </div>
                )}
                {data.map((item, index) => (
                    <div 
                        key={item.country} 
                        className="flex items-center justify-between bg-white/5 rounded px-3 py-1.5 hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className={`
                                w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                                ${index === 0 ? 'bg-yellow-500 text-black' : 
                                  index === 1 ? 'bg-gray-300 text-black' : 
                                  index === 2 ? 'bg-amber-600 text-white' : 'bg-white/10 text-white'}
                            `}>
                                {index + 1}
                            </span>
                            <span className="font-medium text-white">{item.country}</span>
                        </div>
                        <span className="font-mono font-bold text-yellow-400">{item.score}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
