import * as PIXI from "pixi.js";
import { useEffect, useState, useMemo, useRef } from "react";
import { FlagData } from "@/types/game";

interface PixiFlagProps {
    flag: FlagData;
    screenWidth: number;
    screenHeight: number;
    onSelect?: (flag: FlagData) => void;
}

// Cache of resolved textures so remounts never re-request 404s/known URLs.
const textureCache = new Map<string, PIXI.Texture>();
// Countries whose local file 404'd — skip straight to CDN next time.
const localMissingCache = new Set<string>();

async function resolveFlagTexture(country: string): Promise<{ texture: PIXI.Texture | null }> {
    const normalized = country.toLowerCase();
    const cacheKey = `flag:${normalized}`;
    const cached = textureCache.get(cacheKey);
    if (cached) return { texture: cached };

    const cacheIt = (tex: PIXI.Texture) => {
        textureCache.set(cacheKey, tex);
        return { texture: tex };
    };

    // 1. Try Local (skip if previously 404 — public/flags/ is empty by default)
    if (!localMissingCache.has(normalized)) {
        try {
            return cacheIt(await PIXI.Assets.load(`/flags/${normalized}.png`));
        } catch {
            localMissingCache.add(normalized);
        }
    }

    // 2. Try CDN
    if (country.length === 2) {
        try {
            return cacheIt(await PIXI.Assets.load(`https://flagcdn.com/160x120/${normalized}.png`));
        } catch {
            // fall through to text fallback
        }
    }

    return { texture: null };
}

export const PixiFlag = ({ flag, screenWidth, screenHeight, onSelect }: PixiFlagProps) => {
    // Remount per country: fresh texture/error state via lazy useState in the
    // inner component, so the loading effect never needs a synchronous reset.
    return (
        <PixiFlagInner
            key={flag.country}
            flag={flag}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            onSelect={onSelect}
        />
    );
};

const PixiFlagInner = ({ flag, screenWidth, screenHeight, onSelect }: PixiFlagProps) => {
    const [texture, setTexture] = useState<PIXI.Texture | null>(() =>
        textureCache.get(`flag:${flag.country.toLowerCase()}`) ?? null
    );
    const [error, setError] = useState(false);
    const requestRef = useRef(0);

    // Calculate position in pixels
    const x = (flag.x / 100) * screenWidth;
    const y = (flag.y / 100) * screenHeight;

    const radius = 24; 

    useEffect(() => {
        const requestId = ++requestRef.current;
        let cancelled = false;

        // Subscription-style: setState only inside the async callback.
        void resolveFlagTexture(flag.country).then(({ texture: tex }) => {
            if (cancelled || requestRef.current !== requestId) return;
            if (tex) {
                setTexture(tex);
            } else {
                setError(true);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [flag.country]);

    const weaponIcon = useMemo(() => {
        switch (flag.weapon) {
            case "laser": return "⚡";
            case "rocket": return "🚀";
            default: return "💥";
        }
    }, [flag.weapon]);

    // Fallback graphics (circle with text)
    const drawFallback = useMemo(() => {
        return (g: PIXI.Graphics) => {
            g.clear();
            g.circle(0, 0, radius);
            g.fill({ color: flag.isBot ? 0x242730 : 0x3b82f6, alpha: 0.85 });
            g.stroke({ width: 2, color: flag.isBot ? 0x64748b : 0x60a5fa });
        };
    }, [flag.isBot]);

    // Label background
    const drawLabelBg = useMemo(() => {
        return (g: PIXI.Graphics) => {
            g.clear();
            g.roundRect(-36, 0, 72, 22, 6);
            g.fill({ color: flag.isBot ? 0x0f172a : 0x1e1b4b, alpha: 0.85 });
            g.stroke({ width: 1, color: flag.isBot ? 0x334155 : 0xa855f7, alpha: 0.7 });
        };
    }, [flag.isBot]);

    const displayName = useMemo(() => {
        if (!flag.isBot && flag.author) {
            const shortAuthor = flag.author.length > 8 ? `${flag.author.slice(0, 7)}…` : flag.author;
            return `${flag.country} | ${shortAuthor}`;
        }
        return `${flag.country} ${weaponIcon}`;
    }, [flag.country, flag.author, flag.isBot, weaponIcon]);

    return (
        <pixiContainer 
            x={x} 
            y={y} 
            eventMode="static" 
            cursor="pointer" 
            onPointerDown={() => onSelect?.(flag)}
        >
            {/* Flag Image or Fallback */}
            {!error && texture ? (
                <pixiContainer>
                    <pixiSprite 
                        texture={texture} 
                        anchor={0.5} 
                        width={46} 
                        height={34} 
                    />
                </pixiContainer>
            ) : (
                <pixiContainer>
                    <pixiGraphics draw={drawFallback} />
                    <pixiText 
                        text={flag.country.substring(0, 3)} 
                        anchor={0.5} 
                        style={new PIXI.TextStyle({
                            fontSize: 12,
                            fontWeight: 'bold',
                            fill: '#ffffff',
                        })}
                    />
                </pixiContainer>
            )}

            {/* Name Label & Weapon */}
            <pixiContainer y={22}>
                 <pixiGraphics draw={drawLabelBg} />
                 <pixiText 
                    text={displayName}
                    anchor={0.5}
                    x={0}
                    y={11}
                    style={new PIXI.TextStyle({
                        fontSize: 9,
                        fill: flag.isBot ? '#cbd5e1' : '#fef08a',
                        fontWeight: 'bold'
                    })}
                 />
            </pixiContainer>
        </pixiContainer>
    );
};
