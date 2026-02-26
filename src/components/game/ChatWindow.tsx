"use client";

import { useState, useEffect, useRef } from "react";
import { FlagData } from "@/types/game";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatWindowProps {
  flag: FlagData | null;
  onClose: () => void;
}

export function ChatWindow({ flag, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (flag) {
      setMessages([
        {
          role: "system",
          content: `You are the anthropomorphized flag of ${flag.country}. You are currently in a battle royale game. You have a ${flag.weapon} weapon. Be competitive but funny. Keep responses short (under 50 words).

IMPORTANT: Your primary task is to convert audience chat into code. If the user mentions a country or flag change, output the TypeScript code to update the flag image source, following this pattern:
\`setImageSrc("https://flagcdn.com/160x120/xx.png");\`
where 'xx' is the 2-letter ISO code of the requested country (lowercase).`
        },
        {
          role: "assistant",
          content: `Hello! I am ${flag.country}. Ready to win this! 🚩`
        }
      ]);
    }
  }, [flag]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || !flag) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].filter(m => m.role !== "system" || m === messages[0]), // Keep initial system prompt
          model: "meta-llama/llama-3.3-70b-instruct:free" 
        })
      });

      const data = await res.json();
      if (data.choices && data.choices[0]?.message) {
        setMessages(prev => [...prev, data.choices[0].message]);
      } else {
        console.error("No response from AI", data);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!flag) return null;

  return (
    <div className="fixed bottom-4 left-4 w-80 bg-black/80 backdrop-blur-md border border-white/20 rounded-lg shadow-xl flex flex-col overflow-hidden z-[100]">
      {/* Header */}
      <div className="bg-white/10 p-3 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-2">
          <img 
            src={`https://flagcdn.com/24x18/${flag.country.toLowerCase()}.png`} 
            alt={flag.country}
            className="w-6 h-4 object-cover rounded-sm"
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
          <span className="font-bold text-sm">{flag.country.toUpperCase()}</span>
        </div>
        <button 
          onClick={onClose}
          className="text-white/50 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 p-3 overflow-y-auto max-h-64 space-y-2 text-sm"
      >
        {messages.filter(m => m.role !== "system").map((msg, i) => (
          <div 
            key={i} 
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div 
              className={`max-w-[85%] px-3 py-2 rounded-lg ${
                msg.role === "user" 
                  ? "bg-blue-600 text-white rounded-br-none" 
                  : "bg-white/10 text-gray-200 rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-xs text-white/40 italic">Typing...</div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-white/10 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Say something..."
          className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1 text-sm focus:outline-none focus:border-blue-500 transition-colors"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1 rounded text-sm transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
