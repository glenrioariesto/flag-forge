"use client";

import { Application } from "@pixi/react";
import { PixiFlag } from "./PixiFlag";
import { PixiBullet } from "./PixiBullet";
import { FlagData, BulletData } from "@/types/game";

interface PixiStageProps {
    width: number;
    height: number;
    flags: FlagData[];
    bullets: BulletData[];
    onSelectFlag: (flag: FlagData) => void;
}

export default function PixiStage({ width, height, flags, bullets, onSelectFlag }: PixiStageProps) {
    return (
        <Application 
            width={width} 
            height={height} 
            backgroundAlpha={0}
            antialias={true}
        >
            <pixiContainer>
                {flags.map((flag) => (
                    <PixiFlag 
                        key={flag.id} 
                        flag={flag} 
                        screenWidth={width}
                        screenHeight={height}
                        onSelect={onSelectFlag}
                    />
                ))}
                {bullets.map((bullet) => (
                    <PixiBullet 
                        key={bullet.id} 
                        bullet={bullet} 
                        screenWidth={width}
                        screenHeight={height}
                    />
                ))}
            </pixiContainer>
        </Application>
    );
}
