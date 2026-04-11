import { useState, useEffect, useRef } from "react";
import { useListOpenaiConversations, useCreateOpenaiConversation, useListOpenaiMessages, useDeleteOpenaiConversation, useGetOpenaiConversation } from "@workspace/api-client-react";
import { Bot, Send, User, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export function AIChat() {
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamingMessage, setStreamingMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: conversations, isLoading: isLoadingConvos } = useListOpenaiConversations();
  const createConvo = useCreateOpenaiConversation();
  const deleteConvo = useDeleteOpenaiConversation();
  
  const { data: currentConvo } = useGetOpenaiConversation(conversationId!, {
    query: { enabled: !!conversationId, queryKey: ['conversation', conversationId] }
  });

  const { data: messages, isLoading: isLoadingMessages, refetch } = useListOpenaiMessages(conversationId!, {
    query: { enabled: !!conversationId, queryKey: ['messages', conversationId] }
  });

  useEffect(() => {
    if (!isLoadingConvos && conversations) {
      if (conversations.length > 0) {
        setConversationId(conversations[0].id);
      } else {
        createConvo.mutate({ data: { title: "Crypto Session" } }, {
          onSuccess: (res) => setConversationId(res.id)
        });
      }
    }
  }, [isLoadingConvos, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  const sendMessage = async () => {
    if (!input.trim() || !conversationId) return;

    const currentInput = input;
    setInput("");
    setStreamingMessage("...");

    try {
      const response = await fetch(`/api/openai/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: currentInput })
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const data = JSON.parse(line.slice(6));
                accumulated += data.content || "";
                setStreamingMessage(accumulated);
              } catch (e) {}
            }
          }
        }
      }
      setStreamingMessage("");
      refetch();
    } catch (e) {
      console.error(e);
      setStreamingMessage("");
      toast({ description: "Failed to send message", variant: "destructive" });
    }
  };

  const handleDelete = () => {
    if (conversationId) {
      deleteConvo.mutate({ id: conversationId }, {
        onSuccess: () => {
          setConversationId(null);
          createConvo.mutate({ data: { title: "New Crypto Session" } }, {
            onSuccess: (res) => setConversationId(res.id)
          });
          toast({ description: "Conversation cleared", variant: "default" });
        }
      });
    }
  };

  if (!conversationId) return <div className="p-8"><Skeleton className="h-full w-full bg-card" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-4xl mx-auto bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
      <div className="p-4 border-b border-border bg-secondary/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary/20 text-primary flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold font-mono text-lg tracking-tight text-primary">{currentConvo?.title || "CYPHER_NET"}</h2>
            <p className="text-xs text-muted-foreground font-mono">Expert Cryptography Assistant</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 font-mono text-sm">
        {messages?.map((msg) => (
          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/20 text-primary border border-primary/30'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`max-w-[80%] rounded-lg p-4 ${msg.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-primary/5 border border-primary/20 text-foreground'}`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {streamingMessage && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center bg-primary/20 text-primary border border-primary/30">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[80%] rounded-lg p-4 bg-primary/5 border border-primary/20 text-foreground">
              <div className="whitespace-pre-wrap">{streamingMessage}</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-secondary/50 border-t border-border">
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
          className="flex gap-2"
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about ciphers, key sizes, or specific algorithms..."
            className="flex-1 bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm outline-none focus:border-primary transition-colors"
          />
          <Button type="submit" size="icon" disabled={!input.trim()} className="h-auto w-12 shrink-0 bg-primary hover:bg-primary/80 text-primary-foreground disabled:opacity-50">
            <Send className="w-5 h-5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
