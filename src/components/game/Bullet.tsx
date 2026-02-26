import { BulletData } from "@/types/game";

interface BulletProps {
    bullet: BulletData;
}

export const Bullet = ({ bullet }: BulletProps) => {
    const weaponIcon = () => {
        switch (bullet.weapon) {
            case "laser": return "🔴"; // Or a laser beam styling
            case "rocket": return "🚀";
            default: return "⚫";
        }
    };

    // Different styles for different weapons
    const getStyle = () => {
        if (bullet.weapon === "laser") {
            return "text-red-500 drop-shadow-[0_0_2px_rgba(255,0,0,0.8)]";
        }
        return "text-white drop-shadow-md";
    };

    return (
        <div
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 ease-linear will-change-transform ${getStyle()}`}
            style={{
                left: `${bullet.x}%`,
                top: `${bullet.y}%`,
                zIndex: 5,
                fontSize: "clamp(12px, 1.5vw, 20px)"
            }}
        >
            {weaponIcon()}
        </div>
    );
};
