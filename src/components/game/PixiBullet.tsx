import * as PIXI from "pixi.js";
import { useMemo } from "react";
import { BulletData } from "@/types/game";

// Shared style: constructing a TextStyle forces a Pixi text re-layout, and
// bullets churn constantly (one mount per spawn, up to ~100 alive), so this
// must be a module-level singleton rather than a per-component allocation.
const BULLET_TEXT_STYLE = new PIXI.TextStyle({
    fontSize: 20, // clamp(12px, 1.5vw, 20px) - using fixed for now or pass scale
    fill: '#ffffff',
});

interface PixiBulletProps {
    bullet: BulletData;
    screenWidth: number;
    screenHeight: number;
}

export const PixiBullet = ({ bullet, screenWidth, screenHeight }: PixiBulletProps) => {
    // Calculate position in pixels
    const x = (bullet.x / 100) * screenWidth;
    const y = (bullet.y / 100) * screenHeight;

    const weaponIcon = useMemo(() => {
        switch (bullet.weapon) {
            case "laser": return "🔴"; // Using emoji for simplicity in Pixi Text
            case "rocket": return "🚀";
            default: return "⚫";
        }
    }, [bullet.weapon]);

    return (
        <pixiContainer x={x} y={y}>
            <pixiText 
                text={weaponIcon} 
                anchor={0.5} 
                style={BULLET_TEXT_STYLE}
            />
        </pixiContainer>
    );
};
