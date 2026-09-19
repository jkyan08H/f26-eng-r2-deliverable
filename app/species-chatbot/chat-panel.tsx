"use client";
import { toast } from "@/components/ui/use-toast";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";

// Matches the cap enforced by app/api/chat/route.ts. Duplicated rather than shared because the
// server's limit is the one that counts; this copy only spares the user a pointless round trip.
const MAX_MESSAGE_LENGTH = 1000;

interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

export default function ChatPanel() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  // Keep the newest message in view, but only when the reader was already at the bottom -- pulling
  // the pane down under someone who has scrolled up to re-read an earlier answer is worse than
  // making them scroll.
  useEffect(() => {
    const pane = transcriptRef.current;
    if (!pane) return;
    const distanceFromBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight;
    if (distanceFromBottom < 150) pane.scrollTop = pane.scrollHeight;
  }, [chatLog]);

  // Disabling the textarea while a reply is in flight moves focus to <body>, which drops a
  // keyboard-only user out of the composer after every message. Re-focusing when the send finishes
  // puts them back. The ref guard stops this from stealing focus on first render.
  const wasSendingRef = useRef(false);
  useEffect(() => {
    if (wasSendingRef.current && !isSending) textareaRef.current?.focus();
    wasSendingRef.current = isSending;
  }, [isSending]);

  const handleSubmit = async () => {
    const trimmed = message.trim();

    // Ignore empty sends, and never let a second request start while one is in flight.
    if (trimmed === "" || isSending) return;

    // Echo the question immediately rather than after the round trip, so the interface responds to
    // the keystroke instead of to the network.
    setChatLog((previous) => [...previous, { role: "user", content: trimmed }]);
    setMessage("");
    // handleInput only ever grows the textarea, so without this it stays tall after sending.
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      // The route answers with { response } on success and { error } on every failure, so the
      // message shown here is always one the server chose -- never a raw provider or network string.
      const payload = (await response.json()) as { response?: string; error?: string };
      const reply = payload.response;

      if (!response.ok || typeof reply !== "string") {
        throw new Error(payload.error ?? "The species assistant is unavailable right now.");
      }

      setChatLog((previous) => [...previous, { role: "bot", content: reply }]);
    } catch (error) {
      // Roll the question back out of the transcript and into the composer. Leaving an unanswered
      // user bubble behind would read as a message the bot chose to ignore, and retyping a question
      // the network lost is a poor apology.
      setChatLog((previous) => previous.slice(0, -1));
      setMessage(trimmed);
      toast({
        title: "Couldn't send your message.",
        description: error instanceof Error ? error.message : "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter starts a new line -- the convention the page's own intro promises.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <>
      <div className="mx-auto mt-6">
        {/* role="log" + aria-live announces each new message to a screen reader. Deliberately no
            aria-busy: setting it true suppresses live-region announcements, which would silence the
            very replies this region exists to announce. */}
        <div
          ref={transcriptRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation with the species chatbot"
          className="h-[400px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted p-4"
        >
          {chatLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Start chatting about a species!</p>
          ) : (
            chatLog.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl p-3 text-sm ${
                    msg.role === "user"
                      ? "rounded-br-none bg-primary text-slate-900"
                      : "rounded-bl-none border border-border bg-foreground text-background"
                  }`}
                >
                  {/* Bubbles are labelled for screen readers, which otherwise hear a wall of
                      alternating text with no indication of who is speaking. */}
                  <span className="sr-only">{msg.role === "user" ? "You said: " : "Chatbot said: "}</span>
                  {/* Link text is rendered without the anchor. The model is told not to emit links,
                      but a user message could still coax one out, and a clickable link generated
                      from user-influenced text is a phishing vector this page does not need. */}
                  <ReactMarkdown components={{ a: ({ children }) => <>{children}</> }}>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-none border border-border bg-foreground p-3 text-sm text-background">
                Thinking...
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-col items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            disabled={isSending}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            placeholder="Ask about a species..."
            aria-label="Your question about a species"
            className="w-full resize-none overflow-hidden rounded border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            // Also disabled on an empty composer, so the control's appearance matches what it will do.
            disabled={isSending || message.trim() === ""}
            className="mt-2 rounded bg-primary px-4 py-2 text-slate-900 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Enter"}
          </button>
        </div>
      </div>
    </>
  );
}
