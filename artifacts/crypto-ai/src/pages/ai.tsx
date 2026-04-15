import { useState, useEffect, useRef } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useListOpenaiMessages,
  useDeleteOpenaiConversation,
  useGetOpenaiConversation,
  getListOpenaiConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Send, User, Trash2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SUGGESTED = [
  "What is the difference between AES and RSA encryption?",
  "How does AES-256 work in CBC mode?",
  "What makes a Vigenere cipher vulnerable to Kasiski examination?",
  "Explain public key cryptography with a real-world analogy",
  "What is a one-time pad and why is it theoretically unbreakable?",
  "How do salted hashes protect passwords?",
  "How does the XOR cipher work?",
  "How does the Caesar cipher work and why is it weak?",
  "What is Base64 and is it encryption?",
];

export function AIChat() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: conversations, isLoading: isLoadingConvos } = useListOpenaiConversations();
  const createConvo = useCreateOpenaiConversation();
  const deleteConvo = useDeleteOpenaiConversation();

  const { data: currentConvo } = useGetOpenaiConversation(conversationId!, {
    query: { enabled: !!conversationId },
  });

  const { data: messages, isLoading: isLoadingMessages, refetch } = useListOpenaiMessages(conversationId!, {
    query: { enabled: !!conversationId },
  });

  useEffect(() => {
    if (!isLoadingConvos && conversations !== undefined) {
      if (conversations.length > 0) {
        setConversationId(conversations[0].id);
      } else {
        createConvo.mutate(
          { data: { title: "Crypto Session" } },
          { onSuccess: (res) => setConversationId(res.id) }
        );
      }
    }
  }, [isLoadingConvos, conversations?.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || !conversationId || isSending) return;

    setInput("");
    setIsSending(true);
    setStreamingMessage("");

    try {
      const response = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.content) {
                accumulated += data.content;
                setStreamingMessage(accumulated);
              }
            } catch {}
          }
        }
      }

      setStreamingMessage("");
      refetch();
      queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
    } catch {
      toast({ description: "Failed to get a response. Please try again.", variant: "destructive" });
      setStreamingMessage("");
    } finally {
      setIsSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleDelete = () => {
    if (!conversationId) return;
    deleteConvo.mutate({ id: conversationId }, {
      onSuccess: () => {
        setConversationId(null);
        queryClient.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        createConvo.mutate(
          { data: { title: "Crypto Session" } },
          { onSuccess: (res) => setConversationId(res.id) }
        );
        toast({ description: "Conversation cleared" });
      },
    });
  };

  const isEmpty = !isLoadingMessages && (!messages || messages.length === 0) && !streamingMessage;

  return (
    <div className="flex flex-col max-w-4xl mx-auto" style={{ height: "calc(100vh - 5rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border border-border bg-card rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold font-mono text-base text-primary leading-none">
              {currentConvo?.title || "CYPHER_AI"}
            </h2>
            <p className="text-[11px] text-muted-foreground font-mono mt-0.5">Expert Cryptography Assistant · Built-in</p>
          </div>
          <div className="ml-2 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDelete}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-card border-x border-border p-5 flex flex-col gap-5">
        {/* Welcome / empty state */}
        {isEmpty && !isLoadingConvos && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-bold font-mono text-lg text-foreground">AI Cryptography Expert</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Ask anything about encryption, ciphers, key management, or data security.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-xl">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs font-mono p-3 rounded-lg border border-border bg-secondary/30 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoadingMessages && (
          <div className="flex flex-col gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 1 ? "flex-row-reverse" : ""}`}>
                <div className="w-8 h-8 rounded-lg bg-secondary animate-pulse shrink-0" />
                <div className={`h-12 rounded-xl bg-secondary/50 animate-pulse ${i % 2 === 1 ? "w-1/2" : "w-2/3"}`} />
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages?.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div
              className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-xs font-mono font-bold ${
                msg.role === "user"
                  ? "bg-secondary border border-border text-secondary-foreground"
                  : "bg-primary/15 border border-primary/30 text-primary"
              }`}
            >
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-secondary border border-border text-secondary-foreground font-mono"
                  : "bg-background border border-border/60 text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              <div className="text-[10px] text-muted-foreground/50 font-mono mt-2">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {(streamingMessage || isSending) && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg shrink-0 bg-primary/15 border border-primary/30 text-primary flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm bg-background border border-border/60 text-foreground leading-relaxed">
              {streamingMessage ? (
                <span className="whitespace-pre-wrap">
                  {streamingMessage}
                  <span className="animate-pulse ml-0.5 text-primary">▊</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-card border border-t-0 border-border rounded-b-xl">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about algorithms, key sizes, security, or attack vectors..."
            disabled={isSending || !conversationId}
            className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 font-mono text-sm outline-none focus:border-primary transition-colors disabled:opacity-50 placeholder:text-muted-foreground/40"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isSending || !conversationId}
            className="h-auto w-11 shrink-0 bg-primary hover:bg-primary/85 text-primary-foreground disabled:opacity-40"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
        <p className="text-[10px] font-mono text-muted-foreground/40 mt-2 text-center">
          Cryptography knowledge base · Select a topic or ask a question
        </p>
      </div>
    </div>
  );
}
