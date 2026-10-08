"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";
import { SendIcon } from "./Icons";

export const REACTIONS = ["❤️", "😂", "😍", "😘", "🥰", "🍿"];

interface Props {
  messages: ChatMessage[];
  myName: string;
  partnerName: string;
  onSend: (text: string) => void;
  onReact: (emoji: string) => void;
}

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatPanel({ messages, myName, partnerName, onSend, onReact }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <section className="panel flex h-[420px] flex-col lg:h-full">
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <p className="eyebrow">Just us</p>
        <p className="font-display text-sm italic text-cream/45">whispers in the dark</p>
      </header>

      <div ref={listRef} className="scroll-soft flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <p className="mt-10 text-center font-display text-lg italic text-cream/35">
            Say hi to {partnerName} ❤️
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender === myName;
          if (m.kind === "reaction") {
            return (
              <div key={m.id} className="flex justify-center animate-fadeIn">
                <span className="rounded-full bg-white/[0.04] px-3 py-1 text-xs text-cream/60">
                  <span className="mr-1 text-sm">{m.body}</span> {m.sender}
                </span>
              </div>
            );
          }
          return (
            <div key={m.id} className={`flex animate-fadeIn ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${
                    mine ? "rounded-br-md bg-wine-600/90 text-white" : "rounded-bl-md bg-white/[0.07] text-cream"
                  }`}
                >
                  {m.body}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-cream/35">
                  {mine ? "" : `${m.sender} · `}
                  {timeOf(m.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2.5 flex justify-between gap-1">
          {REACTIONS.map((e) => (
            <button
              key={e}
              onClick={() => onReact(e)}
              className="flex h-9 flex-1 items-center justify-center rounded-xl text-xl transition hover:-translate-y-0.5 hover:bg-white/[0.06] active:scale-90"
              aria-label={`Send ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!text.trim()) return;
            onSend(text);
            setText("");
          }}
          className="flex items-center gap-2"
        >
          <input
            className="field py-2.5"
            placeholder={`Message ${partnerName}…`}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-wine-500 text-white transition hover:bg-wine-400 disabled:opacity-40"
            aria-label="Send"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}
