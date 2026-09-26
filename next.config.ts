import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pixi.js", "@pixi/react", "tone", "colyseus.js"],
};

export default nextConfig;
