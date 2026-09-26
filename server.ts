import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, WebSocketTransport } from "colyseus";
import { FlagRoom } from "./src/game/FlagRoom";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const colyseusPort = parseInt(process.env.COLYSEUS_PORT || "3001", 10);
const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const youtubeVideoId = process.env.YOUTUBE_VIDEO_ID;
const youtubeLiveChatId = process.env.YOUTUBE_LIVE_CHAT_ID;
const youtubePollIntervalMs = process.env.YOUTUBE_POLL_INTERVAL_MS;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error("Error occurred handling", req.url, err);
            res.statusCode = 500;
            res.end("internal server error");
        }
    });

    const colyseusServer = createServer();
    const gameServer = new Server({
        transport: new WebSocketTransport({
            server: colyseusServer
        })
    });

    gameServer.define("flag_room", FlagRoom);

    const nextServer = server.listen(port, () => {
        console.log(`> Next.js overlay ready on http://${hostname}:${port}`);
    });
    nextServer.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
            console.error(`[Server] Port ${port} already in use. Set PORT to a free port.`);
        } else {
            console.error("[Server] HTTP server error:", err);
        }
        process.exit(1);
    });

    const colyseusListener = colyseusServer.listen(colyseusPort, () => {
        console.log(`> Colyseus game engine listening on ws://${hostname}:${colyseusPort}`);
    });
    colyseusListener.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
            console.error(`[Server] Colyseus port ${colyseusPort} already in use. Set COLYSEUS_PORT to a free port.`);
        } else {
            console.error("[Server] Colyseus server error:", err);
        }
        process.exit(1);
    });

    import("./src/services/youtube").then(({ youtubeChat }) => {
        if (youtubeApiKey || youtubeVideoId || youtubeLiveChatId) {
            const pollIntervalMs = youtubePollIntervalMs ? Number.parseInt(youtubePollIntervalMs, 10) : undefined;
            void youtubeChat.startListening({
                apiKey: youtubeApiKey,
                liveChatId: youtubeLiveChatId,
                videoId: youtubeVideoId,
                pollIntervalMs: Number.isNaN(pollIntervalMs ?? 0) ? undefined : pollIntervalMs
            }).catch((err) => {
                console.error("[YouTubeChat] Failed to start listening:", err);
            });
        } else {
            console.log("[YouTubeChat] Set YOUTUBE_VIDEO_ID (zero-quota scraper) or YOUTUBE_API_KEY in .env to connect to live chat. Running game with bot simulation only.");
        }
    }).catch((err) => {
        console.error("[YouTubeChat] Failed to load chat service:", err);
    });

    const shutdown = (signal: string) => {
        console.log(`[Server] Received ${signal}, shutting down...`);
        try {
            void gameServer.gracefullyShutdown(false);
        } catch (err) {
            console.error("[Server] Error during Colyseus shutdown:", err);
        }
        nextServer.close(() => process.exit(0));
        // Failsafe: force-exit if connections hang
        setTimeout(() => process.exit(0), 5000).unref();
    };
    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
});
