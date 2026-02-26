import { FlagData } from "@/types/game";
import { useState, useEffect } from "react";

interface FlagProps {
    flag: FlagData;
}

export const Flag = ({ flag }: FlagProps) => {
    const [imageError, setImageError] = useState(false);
    const [imageSrc, setImageSrc] = useState<string>("");

    useEffect(() => {
        // Reset error state when country changes
        setImageError(false);
        
        // Determine image source strategy
        // 1. Try local file in public/flags/
        // 2. If country code is 2 chars, try flagcdn
        // Note: In a real app, we might need a more robust check, but this is a good start.
        // We'll default to trying a local file first if the user says they have "real flags".
        // However, checking if a local file exists via JS client-side isn't direct without a 404.
        // We'll assume a convention: /flags/{country}.png
        
        const normalizedCountry = flag.country.toLowerCase();
        // Priority: Local > CDN (if 2 chars) > Text
        // Since we can't easily check for local existence without a request, we'll try to load it.
        // But for this implementation, we'll set a default path and let onError handle fallback.
        
        // Strategy: 
        // Try /flags/COUNTRY.png first.
        // If that fails, and it's 2 chars, try CDN.
        // If that fails, show text.
        
        setImageSrc(`/flags/${normalizedCountry}.png`);
    }, [flag.country]);

    const handleImageError = () => {
        // If the current src was local, try CDN if applicable
        if (imageSrc.startsWith("/flags/")) {
            // Try CDN if country code is 2 characters (ISO 3166-1 alpha-2)
            // Docs: https://flagcdn.com/
            // We use 160x120 (PNG) for high DPI display (container is ~48px)
            if (flag.country.length === 2) {
                setImageSrc(`https://flagcdn.com/160x120/${flag.country.toLowerCase()}.png`);
            } else {
                setImageError(true);
            }
        } else {
            // If CDN failed or was already fallback
            setImageError(true);
        }
    };

    const weaponIcon = () => {
        switch (flag.weapon) {
            case "laser": return "🔫";
            case "rocket": return "🚀";
            default: return "💣";
        }
    };

    return (
        <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ease-linear will-change-transform"
            style={{
                left: `${flag.x}%`,
                top: `${flag.y}%`,
                zIndex: 10
            }}
        >
            <div className="flex flex-col items-center">
                {/* Flag Display */}
                <div className="relative shadow-lg rounded-full border-2 border-white/80 overflow-hidden bg-black/40 w-12 h-12 flex items-center justify-center">
                    {!imageError ? (
                        <img
                            src={imageSrc}
                            alt={flag.country}
                            className="w-full h-full object-cover"
                            onError={handleImageError}
                        />
                    ) : (
                        <span className="text-xs font-bold text-white truncate max-w-full px-1">
                            {flag.country.substring(0, 3)}
                        </span>
                    )}
                </div>

                {/* Name & Weapon Label */}
                <div className="mt-1 flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm">
                    <span className="text-xs font-semibold text-white shadow-black drop-shadow-md">
                        {flag.country}
                    </span>
                    <span className="text-sm">{weaponIcon()}</span>
                </div>
            </div>
        </div>
    );
};
