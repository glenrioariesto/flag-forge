import { EventEmitter } from "events";
import { SeenIdSet } from "../lib/seenIds";

export type StartOptions = {
    apiKey?: string;
    videoId?: string;
    liveChatId?: string;
    pollIntervalMs?: number;
    enableMockFallback?: boolean;
};

export type ChatMessage = {
    author: string;
    message: string;
    timestamp: number;
    channelId?: string;
    messageId?: string;
    isSuperChat?: boolean;
    isFallbackMock?: boolean;
};

type LiveChatMessageItem = {
    id?: string;
    snippet?: {
        displayMessage?: string;
        publishedAt?: string;
    };
    authorDetails?: {
        displayName?: string;
        channelId?: string;
    };
};

type LiveChatApiResponse = {
    items?: LiveChatMessageItem[];
    nextPageToken?: string;
    pollingIntervalMillis?: number;
    error?: {
        message?: string;
        code?: number;
    };
};

type VideoApiResponse = {
    items?: Array<{
        liveStreamingDetails?: {
            activeLiveChatId?: string;
        };
    }>;
    error?: {
        message?: string;
    };
};

const FALLBACK_NAMES = [
    "Alex_ID", "ChillLofiFan", "PixelRider", "MoonlightBeats", 
    "NightOwl99", "CoffeeLover", "RetroGamer", "CyberNinja",
    "SleepyHead", "StudyPartner", "NeonVibes", "StarGazer"
];

const FALLBACK_COUNTRIES = ["ID", "US", "JP", "BR", "KR", "FR", "DE", "GB", "CA", "AU", "SG", "MY"];

// How many message ids to remember for dedupe. One page is capped at 100
// results, so this comfortably outlives a repeated read of the same page.
const SEEN_MESSAGE_IDS = 500;

export class YouTubeChatService extends EventEmitter {
    private isListening = false;
    private pollTimeout: NodeJS.Timeout | null = null;
    private mockInterval: NodeJS.Timeout | null = null;
    private nextPageToken: string | null = null;
    private liveChatId: string | null = null;
    private apiKey: string | null = null;
    private videoId: string | null = null;
    private pollIntervalMs = 4000;
    private consecutiveErrors = 0;
    private isScraperMode = false;
    private continuationToken: string | null = null;
    private webApiKey: string | null = null;
    private enableMockFallback = true;
    private lastMessageReceivedTime = Date.now();
    private scraperReinitAttempts = 0;
    private seenMessageIds = new SeenIdSet(SEEN_MESSAGE_IDS);

    public async startListening(options: StartOptions) {
        if (this.isListening) return;

        this.apiKey = options.apiKey || null;
        this.videoId = options.videoId || null;
        this.liveChatId = options.liveChatId || null;
        this.pollIntervalMs = Math.max(3000, options.pollIntervalMs ?? 4000);
        this.enableMockFallback = options.enableMockFallback ?? true;
        this.isListening = true;
        this.consecutiveErrors = 0;
        this.lastMessageReceivedTime = Date.now();

        console.log("[YouTubeChat] Initializing Live Ingestion with 4-Tier Fallback Safety Net...");

        // Tier 1 & 2 Setup
        if (!this.apiKey && this.videoId) {
            console.log("[YouTubeChat] [Tier 2] Starting Zero-Quota LiveChat Scraper for video:", this.videoId);
            this.isScraperMode = true;
            await this.initScraper();
            return;
        }

        if (!this.apiKey && !this.videoId) {
            console.warn("[YouTubeChat] [Tier 3 Fallback] No API Key / Video ID provided. Running Autonomous Live Simulation...");
            this.startAutonomousMockChat();
            return;
        }

        const liveChatId = this.liveChatId ?? (this.videoId ? await this.fetchLiveChatId(this.videoId) : null);
        if (!liveChatId) {
            if (this.videoId) {
                console.log("[YouTubeChat] [Tier 2 Fallback] Switching to Zero-Quota Web Scraper...");
                this.isScraperMode = true;
                this.liveChatId = null;
                await this.initScraper();
                return;
            }
            console.warn("[YouTubeChat] [Tier 3 Fallback] Video lookup returned no active chat. Activating Mock Chat Fallback.");
            this.startAutonomousMockChat();
            return;
        }

        if (!this.apiKey) {
            // A raw liveChatId without an API key cannot be polled (Tier 1 needs a key).
            console.warn("[YouTubeChat] liveChatId provided without YOUTUBE_API_KEY — Tier 1 polling is impossible.");
            if (this.videoId) {
                console.log("[YouTubeChat] [Tier 2 Fallback] Switching to Zero-Quota Web Scraper...");
                this.isScraperMode = true;
                this.liveChatId = null;
                await this.initScraper();
                return;
            }
            this.startAutonomousMockChat();
            return;
        }

        this.liveChatId = liveChatId;
        this.nextPageToken = null;
        console.log(`[YouTubeChat] [Tier 1] Listening to liveChatId: ${liveChatId} (Adaptive: ${this.pollIntervalMs}ms)`);
        await this.pollLoop();
    }

    public stopListening() {
        this.isListening = false;
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
        if (this.mockInterval) {
            clearInterval(this.mockInterval);
            this.mockInterval = null;
        }
        this.resetTransportState();
        this.scraperReinitAttempts = 0;
        console.log("[YouTubeChat] Stopped listening.");
    }

    private resetTransportState() {
        this.nextPageToken = null;
        this.liveChatId = null;
        this.continuationToken = null;
        this.webApiKey = null;
        this.isScraperMode = false;
        this.consecutiveErrors = 0;
        this.seenMessageIds.clear();
    }

    private async pollLoop() {
        if (!this.isListening) return;

        try {
            if (this.isScraperMode) {
                await this.pollScraper();
            } else {
                const messages = await this.fetchMessages();
                for (const message of messages) {
                    // messageId was already being parsed and stored but never
                    // read, so a re-read page replayed every message and the
                    // engine spawned duplicate flags on each poll.
                    if (message.messageId && !this.seenMessageIds.add(message.messageId)) {
                        continue;
                    }
                    this.lastMessageReceivedTime = Date.now();
                    this.emit("chat_message", message);
                }
                this.consecutiveErrors = 0;
            }
        } catch (err: unknown) {
            this.consecutiveErrors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(`[YouTubeChat] Poll warning (${this.consecutiveErrors}/5):`, errMsg);

            // Tier 1 -> Tier 2 Fallback: If Quota Exceeded (403), switch seamlessly to web scraper
            if (errMsg.includes("quotaExceeded") || errMsg.includes("403")) {
                if (this.videoId && !this.isScraperMode) {
                    console.warn("[YouTubeChat] [Tier 2 Fallback] API Quota Exceeded. Switching seamlessly to Zero-Quota Scraper...");
                    this.isScraperMode = true;
                    await this.initScraper();
                    return;
                }
            }

            // Tier 2 -> Tier 3 Fallback: If 5 consecutive errors occur (e.g. internet down / stream ended), keep stream alive
            if (this.consecutiveErrors >= 5 && this.enableMockFallback && !this.mockInterval) {
                console.warn("[YouTubeChat] [Tier 3 Fallback] Network disconnect detected. Activating Emergency Mock Chat Loop to keep live stream active.");
                this.startAutonomousMockChat();
            }

            // Exponential backoff & auto-recovery
            const backoff = Math.min(25000, this.pollIntervalMs * Math.pow(1.4, Math.min(this.consecutiveErrors, 5)));
            this.scheduleNextPoll(backoff);
            return;
        }

        this.scheduleNextPoll(this.pollIntervalMs);
    }

    private scheduleNextPoll(delayMs: number) {
        if (!this.isListening) return;
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
        }
        this.pollTimeout = setTimeout(() => {
            this.pollTimeout = null;
            void this.pollLoop();
        }, delayMs);
    }

    private async fetchMessages(): Promise<ChatMessage[]> {
        if (!this.apiKey || !this.liveChatId) return [];

        const params = new URLSearchParams({
            liveChatId: this.liveChatId,
            part: "snippet,authorDetails",
            key: this.apiKey,
            maxResults: "100"
        });
        if (this.nextPageToken) {
            params.set("pageToken", this.nextPageToken);
        }

        const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?${params.toString()}`);
        const data = (await response.json()) as LiveChatApiResponse;

        if (!response.ok || data.error) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }

        this.nextPageToken = data.nextPageToken ?? this.nextPageToken;
        if (data.pollingIntervalMillis) {
            this.pollIntervalMs = Math.max(3000, data.pollingIntervalMillis);
        }

        return (data.items ?? [])
            .map((item) => {
                const message = item.snippet?.displayMessage;
                if (!message) return null;
                const publishedAt = item.snippet?.publishedAt ? Date.parse(item.snippet.publishedAt) : Date.now();
                const payload: ChatMessage = {
                    author: item.authorDetails?.displayName ?? "Anonymous",
                    message,
                    timestamp: Number.isNaN(publishedAt) ? Date.now() : publishedAt
                };
                if (item.authorDetails?.channelId) {
                    payload.channelId = item.authorDetails.channelId;
                }
                if (item.id) {
                    payload.messageId = item.id;
                }
                return payload;
            })
            .filter((item): item is ChatMessage => item !== null);
    }

    private async fetchLiveChatId(videoId: string): Promise<string | null> {
        if (!this.apiKey || !videoId) return null;
        try {
            const params = new URLSearchParams({
                id: videoId,
                part: "liveStreamingDetails",
                key: this.apiKey
            });

            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
            const data = (await response.json()) as VideoApiResponse;

            if (!response.ok || data.error) {
                return null;
            }

            return data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
        } catch {
            return null;
        }
    }

    // --- ZERO-QUOTA SCRAPER FALLBACK (Tier 2) ---
    private async initScraper() {
        if (!this.videoId) {
            this.startAutonomousMockChat();
            return;
        }
        try {
            const res = await fetch(`https://www.youtube.com/live_chat?v=${this.videoId}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
            const html = await res.text();

            const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
            if (apiKeyMatch) {
                this.webApiKey = apiKeyMatch[1];
            }

            const continuationMatch = html.match(/"continuation":"([^"]+)"/);
            if (continuationMatch) {
                this.continuationToken = continuationMatch[1];
            }

            console.log(`[YouTubeChat] Scraper initialized. Token present: ${Boolean(this.continuationToken)}`);
            this.consecutiveErrors = 0;
            await this.pollLoop();
        } catch (e) {
            console.error("[YouTubeChat] Scraper init warning, will retry in 10s:", e);
            // Go through scheduleNextPoll so any pending timer is replaced
            // rather than left running alongside this one.
            this.scheduleNextPoll(10000);
        }
    }

    private async pollScraper() {
        if (!this.continuationToken || !this.webApiKey) {
            // Token/key expired mid-stream: re-init (bounded), else degrade to mock.
            this.scraperReinitAttempts += 1;
            if (this.scraperReinitAttempts > 3) {
                console.error("[YouTubeChat] Scraper token lost repeatedly — activating Mock Chat Fallback.");
                this.continuationToken = null;
                this.webApiKey = null;
                if (this.enableMockFallback) this.startAutonomousMockChat();
                this.scheduleNextPoll(this.pollIntervalMs);
                return;
            }
            console.warn("[YouTubeChat] Scraper token missing — re-initializing scraper...");
            await this.initScraper();
            return;
        }
        this.scraperReinitAttempts = 0;

        const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${this.webApiKey}`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: "WEB",
                        clientVersion: "2.20240101.00.00"
                    }
                },
                continuation: this.continuationToken
            })
        });

        if (!res.ok) {
            throw new Error(`Scraper HTTP ${res.status}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (await res.json()) as any;
        const liveChatRenderer = data?.continuationContents?.liveChatContinuation;
        if (!liveChatRenderer) return;

        const nextCont = liveChatRenderer?.continuations?.[0]?.invalidationContinuationData?.continuation 
            ?? liveChatRenderer?.continuations?.[0]?.timedContinuationData?.continuation;
        if (nextCont) {
            this.continuationToken = nextCont;
        }

        const timeoutMs = liveChatRenderer?.continuations?.[0]?.timedContinuationData?.timeoutMs;
        if (timeoutMs) {
            this.pollIntervalMs = Math.max(2500, timeoutMs);
        }

        const actions = liveChatRenderer?.actions || [];
        for (const action of actions) {
            const item = action?.addChatItemAction?.item?.liveChatTextMessageRenderer;
            if (item) {
                const author = item?.authorName?.simpleText || "Viewer";
                const runs = item?.message?.runs || [];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const message = runs.map((r: any) => r.text || "").join("").trim();
                if (message) {
                    this.lastMessageReceivedTime = Date.now();
                    this.emit("chat_message", {
                        author,
                        message,
                        timestamp: Date.now()
                    });
                }
            }
        }
    }

    // --- AUTONOMOUS MOCK CHAT FALLBACK (Tier 3) ---
    private startAutonomousMockChat() {
        if (this.mockInterval) return;
        console.log("[YouTubeChat] [Tier 3] Emergency Fallback Simulator Active (Periodically generating simulated chat activity)...");

        this.mockInterval = setInterval(() => {
            if (!this.isListening) return;

            // Only generate mock chat if no real message received in the last 12 seconds
            if (Date.now() - this.lastMessageReceivedTime > 12000) {
                const randomCountry = FALLBACK_COUNTRIES[Math.floor(Math.random() * FALLBACK_COUNTRIES.length)];
                const randomName = FALLBACK_NAMES[Math.floor(Math.random() * FALLBACK_NAMES.length)];
                this.emit("chat_message", {
                    author: randomName,
                    message: randomCountry,
                    timestamp: Date.now(),
                    isFallbackMock: true
                });
            }
        }, 8000);
    }
}

export const youtubeChat = new YouTubeChatService();
