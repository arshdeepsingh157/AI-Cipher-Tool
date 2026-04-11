import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEncryptText, useDecryptText, useGenerateKey } from "@workspace/api-client-react";
import { EncryptRequestAlgorithm, DecryptRequestAlgorithm } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import { Copy, RefreshCw, ArrowRightLeft, Key, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const algorithms = [
  { id: "AES", name: "AES-256", desc: "Advanced Encryption Standard. Military grade.", requiresKey: true },
  { id: "Base64", name: "Base64", desc: "Encoding scheme. Not secure.", requiresKey: false },
  { id: "Caesar", name: "Caesar Cipher", desc: "Classic substitution cipher.", requiresKey: false, requiresShift: true },
  { id: "ROT13", name: "ROT13", desc: "Substitute by 13 places.", requiresKey: false },
  { id: "Vigenere", name: "Vigenère", desc: "Polyalphabetic substitution.", requiresKey: true },
  { id: "XOR", name: "XOR Cipher", desc: "Exclusive OR operation.", requiresKey: true },
];

export function Home() {
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [algo, setAlgo] = useState<string>("AES");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [key, setKey] = useState("");
  const [shift, setShift] = useState(3);
  const { toast } = useToast();

  const encryptMutation = useEncryptText();
  const decryptMutation = useDecryptText();
  const generateKeyMutation = useGenerateKey();

  const selectedAlgo = algorithms.find(a => a.id === algo);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!input.trim()) {
        setOutput("");
        return;
      }
      
      const payload = {
        text: input,
        algorithm: algo as any,
        key: selectedAlgo?.requiresKey ? key : undefined,
        shift: selectedAlgo?.requiresShift ? shift : undefined,
      };

      if (selectedAlgo?.requiresKey && !key) return;

      if (mode === "encrypt") {
        encryptMutation.mutate({ data: payload }, {
          onSuccess: (res) => setOutput(res.encrypted),
          onError: () => setOutput("Error processing request")
        });
      } else {
        decryptMutation.mutate({ data: payload }, {
          onSuccess: (res) => setOutput(res.decrypted),
          onError: () => setOutput("Error processing request")
        });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [input, algo, key, shift, mode]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: "Copied to clipboard", variant: "default" });
  };

  const generateNewKey = () => {
    generateKeyMutation.mutate({ data: { algorithm: algo as any } }, {
      onSuccess: (res) => setKey(res.key)
    });
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-primary flex items-center gap-3">
            <Zap className="w-8 h-8" />
            WORKSPACE
          </h1>
          <p className="text-muted-foreground mt-2">Real-time cryptographic operations sandbox.</p>
        </div>
        
        <div className="flex bg-secondary p-1 rounded-lg border border-border">
          <button 
            onClick={() => setMode("encrypt")}
            className={`px-6 py-2 rounded-md font-mono text-sm font-bold transition-all ${mode === "encrypt" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            ENCRYPT
          </button>
          <button 
            onClick={() => setMode("decrypt")}
            className={`px-6 py-2 rounded-md font-mono text-sm font-bold transition-all ${mode === "decrypt" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            DECRYPT
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {algorithms.map((a) => (
          <div 
            key={a.id}
            onClick={() => setAlgo(a.id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${algo === a.id ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,255,255,0.1)]" : "border-border bg-card hover:border-muted-foreground/50"}`}
          >
            <div className="font-mono font-bold text-lg mb-1">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.desc}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 h-[400px]">
        {/* Input Panel */}
        <div className="bg-card border border-border rounded-xl flex flex-col relative overflow-hidden group">
          <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/50">
            <span className="font-mono text-sm font-bold text-muted-foreground">
              {mode === "encrypt" ? "PLAINTEXT" : "CIPHERTEXT"}
            </span>
            <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleCopy(input)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <textarea 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Enter text to ${mode}...`}
            className="flex-1 bg-transparent p-4 resize-none outline-none font-mono text-sm"
          />
        </div>

        {/* Center Controls */}
        <div className="flex flex-col items-center justify-center gap-4 px-2">
          <div className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-primary shadow-[0_0_20px_rgba(0,255,255,0.2)]">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          
          {selectedAlgo?.requiresKey && (
            <div className="bg-card border border-primary/50 rounded-lg p-3 w-48 flex flex-col gap-2">
              <div className="text-xs font-mono text-primary flex items-center gap-1"><Key className="w-3 h-3"/> KEY REQUIRED</div>
              <input 
                type="text" 
                value={key} 
                onChange={(e) => setKey(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono w-full outline-none focus:border-primary"
                placeholder="Enter secret key..."
              />
              <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={generateNewKey}>
                <RefreshCw className="w-3 h-3 mr-1" /> Generate
              </Button>
            </div>
          )}
          
          {selectedAlgo?.requiresShift && (
            <div className="bg-card border border-border rounded-lg p-3 w-48 flex flex-col gap-2">
              <div className="text-xs font-mono text-muted-foreground">SHIFT VALUE</div>
              <input 
                type="number" 
                value={shift} 
                onChange={(e) => setShift(Number(e.target.value))}
                className="bg-background border border-border rounded px-2 py-1 text-xs font-mono w-full outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Output Panel */}
        <div className="bg-card border border-primary/30 rounded-xl flex flex-col relative overflow-hidden group shadow-[0_0_30px_rgba(0,255,255,0.05)]">
          <div className="flex items-center justify-between p-4 border-b border-primary/20 bg-primary/5">
            <span className="font-mono text-sm font-bold text-primary">
              {mode === "encrypt" ? "CIPHERTEXT" : "PLAINTEXT"}
            </span>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-primary hover:text-primary hover:bg-primary/20" onClick={() => handleCopy(output)}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex-1 p-4 overflow-auto font-mono text-sm text-primary break-all relative">
             <AnimatePresence mode="popLayout">
                <motion.div
                  key={output}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {output || (
                    <span className="text-primary/30">
                      {selectedAlgo?.requiresKey && !key 
                        ? "// Waiting for valid key..." 
                        : "// Output will appear here..."}
                    </span>
                  )}
                </motion.div>
             </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
