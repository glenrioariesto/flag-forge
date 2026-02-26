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

    // Calculate position in pixels
    const x = (flag.x / 100) * screenWidth;
    const y = (flag.y / 100) * screenHeight;

    // Radius for the flag circle
    const radius = 24; 

    useEffect(() => {
        let isMounted = true;
        setError(false);
        setTexture(null);

        const loadTexture = async () => {
            const normalizedCountry = flag.country.toLowerCase();
            
            // 1. Try Local
            const localPath = `/flags/${normalizedCountry}.png`;
            try {
                const tex = await PIXI.Assets.load(localPath);
                if (isMounted) {
                    setTexture(tex);
                    return;
                }
            } catch {
                // Ignore local load error
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
    }, [flag.country]);

    const weaponIcon = useMemo(() => {
        switch (flag.weapon) {
            case "laser": return "🔫";
            case "rocket": return "🚀";
            default: return "💣";
        }
    }, [flag.weapon]);

    // Fallback graphics (circle with text)
    const drawFallback = useMemo(() => {
        return (g: PIXI.Graphics) => {
            g.clear();
            g.circle(0, 0, radius);
            g.fill({ color: 0x333333, alpha: 0.8 });
            g.stroke({ width: 2, color: 0xffffff });
        };
    }, []);

    // Label background
    const drawLabelBg = useMemo(() => {
        return (g: PIXI.Graphics) => {
            g.clear();
            g.roundRect(-30, 0, 60, 20, 10);
            g.fill({ color: 0x000000, alpha: 0.6 });
            g.stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
        };
    }, []);

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
                    {/* Masked Sprite workaround: render graphics then sprite? 
                        In intrinsic elements, 'mask' prop might not work easily with refs.
                        Simple rect sprite for now.
                    */}
                    <pixiSprite 
                        texture={texture} 
                        anchor={0.5} 
                        width={48} 
                        height={36} 
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
            <pixiContainer y={24}>
                 <pixiGraphics draw={drawLabelBg} />
                 <pixiText 
                    text={`${flag.country} ${weaponIcon}`}
                    anchor={0.5}
                    x={0}
                    y={10}
                    style={new PIXI.TextStyle({
                        fontSize: 10,
                        fill: '#ffffff',
                        fontWeight: 'bold'
                    })}
                 />
            </pixiContainer>
        </pixiContainer>
    );
};
