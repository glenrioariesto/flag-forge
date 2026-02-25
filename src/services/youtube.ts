import { EventEmitter } from "events";

type StartOptions = {
    apiKey: string;
    videoId?: string;
    liveChatId?: string;
    pollIntervalMs?: number;
};

type ChatMessage = {
    author: string;
    message: string;
    timestamp: number;
    channelId?: string;
    messageId?: string;
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

export class YouTubeChatService extends EventEmitter {
    private isListening = false;
    private pollTimeout: NodeJS.Timeout | null = null;
    private nextPageToken: string | null = null;
    private liveChatId: string | null = null;
    private apiKey: string | null = null;
    private pollIntervalMs = 2000;

    public async startListening(options: StartOptions) {
        if (this.isListening) return;
        if (!options.apiKey) {
            console.error("[YouTubeChat] Missing YOUTUBE_API_KEY");
            return;
        }
        if (!options.liveChatId && !options.videoId) {
            console.error("[YouTubeChat] Missing YOUTUBE_LIVE_CHAT_ID or YOUTUBE_VIDEO_ID");
            return;
        }

        this.isListening = true;
        this.apiKey = options.apiKey;
        this.pollIntervalMs = options.pollIntervalMs ?? 2000;

        const liveChatId = options.liveChatId ?? (await this.fetchLiveChatId(options.videoId ?? ""));
        if (!liveChatId) {
            this.isListening = false;
            return;
        }

        this.liveChatId = liveChatId;
        this.nextPageToken = null;
        console.log(`[YouTubeChat] Started listening to liveChatId: ${liveChatId}`);
        await this.pollLoop();
    }

    public stopListening() {
        this.isListening = false;
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
        this.nextPageToken = null;
        this.liveChatId = null;
        console.log("[YouTubeChat] Stopped listening.");
    }

    private async pollLoop() {
        if (!this.isListening || !this.apiKey || !this.liveChatId) return;
        try {
            const messages = await this.fetchMessages();
            for (const message of messages) {
                this.emit("chat_message", message);
            }
        } catch (err) {
            console.error("[YouTubeChat] Poll error", err);
        }

        if (!this.isListening) return;
        this.pollTimeout = setTimeout(() => {
            void this.pollLoop();
        }, this.pollIntervalMs);
    }

    private async fetchMessages(): Promise<ChatMessage[]> {
        if (!this.apiKey || !this.liveChatId) return [];

        const params = new URLSearchParams({
            liveChatId: this.liveChatId,
            part: "snippet,authorDetails",
            key: this.apiKey,
            maxResults: "200"
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
            this.pollIntervalMs = Math.max(1000, data.pollingIntervalMillis);
        }

        return (data.items ?? [])
            .map((item) => {
                const message = item.snippet?.displayMessage;
                if (!message) return null;
                const publishedAt = item.snippet?.publishedAt ? Date.parse(item.snippet.publishedAt) : Date.now();
                const payload: ChatMessage = {
                    author: item.authorDetails?.displayName ?? "Unknown",
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
        const params = new URLSearchParams({
            id: videoId,
            part: "liveStreamingDetails",
            key: this.apiKey
        });

        const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`);
        const data = (await response.json()) as VideoApiResponse;

        if (!response.ok || data.error) {
            console.error("[YouTubeChat] Video lookup failed", data.error?.message || response.status);
            return null;
        }

        const liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
        if (!liveChatId) {
            console.error("[YouTubeChat] activeLiveChatId not found for video");
        }
        return liveChatId;
    }
}

export const youtubeChat = new YouTubeChatService();
