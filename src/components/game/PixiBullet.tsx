import * as PIXI from "pixi.js";
import { useMemo } from "react";
import { BulletData } from "@/types/game";

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

    const style = useMemo(() => {
        return new PIXI.TextStyle({
            fontSize: 20, // clamp(12px, 1.5vw, 20px) - using fixed for now or pass scale
            fill: '#ffffff',
            // dropShadow: true... Pixi text shadow is expensive?
        });
    }, []);

    return (
        <pixiContainer x={x} y={y}>
            <pixiText 
                text={weaponIcon} 
                anchor={0.5} 
                style={style}
            />
        </pixiContainer>
    );
};
