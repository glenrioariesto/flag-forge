import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server, WebSocketTransport } from "colyseus";
import { FlagRoom } from "./src/game/FlagRoom";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
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
        console.log(`> Ready on http://${hostname}:${port}`);
    });

    colyseusServer.listen(3001, () => {
        console.log(`> Colyseus server listening on ws://${hostname}:3001`);
    });

    import("./src/services/youtube").then(({ youtubeChat }) => {
        if (youtubeApiKey && (youtubeLiveChatId || youtubeVideoId)) {
            const pollIntervalMs = youtubePollIntervalMs ? Number.parseInt(youtubePollIntervalMs, 10) : undefined;
            void youtubeChat.startListening({
                apiKey: youtubeApiKey,
                liveChatId: youtubeLiveChatId,
                videoId: youtubeVideoId,
                pollIntervalMs: Number.isNaN(pollIntervalMs ?? 0) ? undefined : pollIntervalMs
            });
        } else {
            console.log("[YouTubeChat] Set YOUTUBE_API_KEY and YOUTUBE_VIDEO_ID or YOUTUBE_LIVE_CHAT_ID to enable live chat");
        }
    });
});
