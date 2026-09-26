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

    server.listen(port, () => {
        console.log(`> Next.js overlay ready on http://${hostname}:${port}`);
    });

    colyseusServer.listen(colyseusPort, () => {
        console.log(`> Colyseus game engine listening on ws://${hostname}:${colyseusPort}`);
    });

    import("./src/services/youtube").then(({ youtubeChat }) => {
        if (youtubeApiKey || youtubeVideoId || youtubeLiveChatId) {
            const pollIntervalMs = youtubePollIntervalMs ? Number.parseInt(youtubePollIntervalMs, 10) : undefined;
            void youtubeChat.startListening({
                apiKey: youtubeApiKey,
                liveChatId: youtubeLiveChatId,
                videoId: youtubeVideoId,
                pollIntervalMs: Number.isNaN(pollIntervalMs ?? 0) ? undefined : pollIntervalMs
            });
        } else {
            console.log("[YouTubeChat] Set YOUTUBE_VIDEO_ID (zero-quota scraper) or YOUTUBE_API_KEY in .env to connect to live chat.");
        }
    });
});
