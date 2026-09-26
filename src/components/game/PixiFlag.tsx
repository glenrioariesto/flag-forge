import * as PIXI from "pixi.js";
import { useEffect, useState, useMemo } from "react";
import { FlagData } from "@/types/game";

interface PixiFlagProps {
    flag: FlagData;
    screenWidth: number;
    screenHeight: number;
    onSelect?: (flag: FlagData) => void;
}

export const PixiFlag = ({ flag, screenWidth, screenHeight, onSelect }: PixiFlagProps) => {
    const [texture, setTexture] = useState<PIXI.Texture | null>(null);
    const [error, setError] = useState(false);
    // Empty string = not yet tried; avoids re-requesting a known-missing local asset every render.
    const [localMissing, setLocalMissing] = useState(false);

    // Calculate position in pixels
    const x = (flag.x / 100) * screenWidth;
    const y = (flag.y / 100) * screenHeight;

    const radius = 24; 

    useEffect(() => {
        let isMounted = true;
        setError(false);
        setTexture(null);

        const loadTexture = async () => {
            const normalizedCountry = flag.country.toLowerCase();

            // 1. Try Local (skip on retry if already 404 — public/flags/ is empty by default)
            if (!localMissing) {
                const localPath = `/flags/${normalizedCountry}.png`;
                try {
                    const tex = await PIXI.Assets.load(localPath);
                    if (isMounted) {
                        setTexture(tex);
                        return;
                    }
                } catch {
                    // Remember 404 so remounts with the same bundle skip straight to CDN
                    if (isMounted) setLocalMissing(true);
                }
            }

            // 2. Try CDN
            if (flag.country.length === 2) {
                try {
                    const cdnUrl = `https://flagcdn.com/160x120/${normalizedCountry}.png`;
                    const tex = await PIXI.Assets.load(cdnUrl);
                    if (isMounted) {
                        setTexture(tex);
                        return;
                    }
                } catch {
                    // Ignore CDN error
                }
            }

            // 3. Fallback
            if (isMounted) {
                setError(true);
            }
        };

        loadTexture();

        return () => {
            isMounted = false;
        };
    }, [flag.country, localMissing]);

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
