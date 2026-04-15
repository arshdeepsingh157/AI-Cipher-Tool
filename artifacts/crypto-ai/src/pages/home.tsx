import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEncryptText, useDecryptText, useGenerateKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Copy, RefreshCw, ArrowRightLeft, Key, Lock, Unlock,
  CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp, Loader2,
  Upload, FileDown, FileText, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AlgorithmId = "AES" | "Caesar" | "Base64" | "ROT13" | "Vigenere" | "XOR";

const algorithms: {
  id: AlgorithmId;
  name: string;
  shortName: string;
  desc: string;
  requiresKey: boolean;
  requiresShift?: boolean;
  securityLevel: "High" | "Medium" | "Low" | "None";
  securityColor: string;
  bits?: string;
  useCase: string;
  keyNote: string;
}[] = [
  {
    id: "AES",
    name: "AES-256",
    shortName: "AES",
    desc: "Advanced Encryption Standard. Military-grade symmetric cipher.",
    requiresKey: true,
    securityLevel: "High",
    securityColor: "text-emerald-400",
    bits: "256-bit",
    useCase: "Secure file storage, TLS, disk encryption",
    keyNote: "Any passphrase — hashed to 256-bit key internally",
  },
  {
    id: "Base64",
    name: "Base64",
    shortName: "B64",
    desc: "Binary-to-text encoding. Not encryption — easily reversible.",
    requiresKey: false,
    securityLevel: "None",
    securityColor: "text-zinc-400",
    bits: "N/A",
    useCase: "Data transmission, email attachments, URLs",
    keyNote: "No key required — deterministic encoding",
  },
  {
    id: "Caesar",
    name: "Caesar Cipher",
    shortName: "CAES",
    desc: "Shift cipher used by Julius Caesar. Trivially broken by brute force.",
    requiresKey: false,
    requiresShift: true,
    securityLevel: "None",
    securityColor: "text-zinc-400",
    bits: "~5-bit",
    useCase: "Education, puzzles, ROT-N variants",
    keyNote: "Shift value 1–25 (26 = no change)",
  },
  {
    id: "ROT13",
    name: "ROT13",
    shortName: "R13",
    desc: "Caesar cipher with fixed shift of 13. Its own inverse — apply twice to recover.",
    requiresKey: false,
    securityLevel: "None",
    securityColor: "text-zinc-400",
    bits: "~5-bit",
    useCase: "Spoiler hiding, forum obfuscation",
    keyNote: "No key needed — shift is always 13",
  },
  {
    id: "Vigenere",
    name: "Vigenère",
    shortName: "VIG",
    desc: "Polyalphabetic substitution cipher. Resistant to simple frequency analysis.",
    requiresKey: true,
    securityLevel: "Low",
    securityColor: "text-yellow-400",
    bits: "Variable",
    useCase: "Historical correspondence, educational demos",
    keyNote: "Alphabetic keyword — longer = stronger",
  },
  {
    id: "XOR",
    name: "XOR Cipher",
    shortName: "XOR",
    desc: "Bitwise XOR with a repeating key. Secure only when key = message length (OTP).",
    requiresKey: true,
    securityLevel: "Medium",
    securityColor: "text-amber-400",
    bits: "Key-dependent",
    useCase: "Stream ciphers, one-time pads, quick obfuscation",
    keyNote: "Hex key — longer key = stronger encryption",
  },
];

const securityBadge: Record<string, string> = {
  High: "bg-emerald-900/40 text-emerald-400 border-emerald-700/50",
  Medium: "bg-amber-900/40 text-amber-400 border-amber-700/50",
  Low: "bg-yellow-900/40 text-yellow-400 border-yellow-700/50",
  None: "bg-zinc-800/40 text-zinc-400 border-zinc-700/50",
};

export function Home() {
  const [mode, setMode] = useState<"encrypt" | "decrypt">("encrypt");
  const [algo, setAlgo] = useState<AlgorithmId>("AES");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [key, setKey] = useState("");
  const [shift, setShift] = useState(3);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const { toast } = useToast();

  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileResult, setFileResult] = useState<{ data: string; downloadName: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const encryptMutation = useEncryptText();
  const decryptMutation = useDecryptText();
  const generateKeyMutation = useGenerateKey();

  const selectedAlgo = algorithms.find((a) => a.id === algo)!;
  const isPending = encryptMutation.isPending || decryptMutation.isPending;

  const runOperation = useCallback(() => {
    if (!input.trim()) {
      setOutput("");
      setProcessingTime(null);
      return;
    }
    if (selectedAlgo.requiresKey && !key.trim()) return;

    const payload = {
      text: input,
      algorithm: algo as any,
      key: selectedAlgo.requiresKey ? key : undefined,
      shift: selectedAlgo.requiresShift ? shift : undefined,
    };

    if (mode === "encrypt") {
      encryptMutation.mutate({ data: payload }, {
        onSuccess: (res) => {
          setOutput(res.encrypted);
          setProcessingTime(res.processingTime);
        },
        onError: (err: any) => {
          const msg = err?.data?.error || "Encryption failed";
          setOutput(`ERROR: ${msg}`);
          setProcessingTime(null);
        },
      });
    } else {
      decryptMutation.mutate({ data: payload }, {
        onSuccess: (res) => {
          setOutput(res.decrypted);
          setProcessingTime(res.processingTime);
        },
        onError: (err: any) => {
          const msg = err?.data?.error || "Decryption failed — check key or input";
          setOutput(`ERROR: ${msg}`);
          setProcessingTime(null);
        },
      });
    }
  }, [input, algo, key, shift, mode]);

  useEffect(() => {
    if (inputMode === "file") return;
    const timer = setTimeout(runOperation, 350);
    return () => clearTimeout(timer);
  }, [input, algo, key, shift, mode, inputMode]);

  const handleCopy = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copied to clipboard` });
  };

  const handleSwap = () => {
    if (!output || output.startsWith("ERROR:")) return;
    setInput(output);
    setOutput("");
    setMode((m) => (m === "encrypt" ? "decrypt" : "encrypt"));
  };

  const generateNewKey = () => {
    generateKeyMutation.mutate({ data: { algorithm: algo as any } }, {
      onSuccess: (res) => {
        if (selectedAlgo.requiresShift) {
          setShift(parseInt(res.key) || 3);
        } else {
          setKey(res.key);
        }
        toast({ description: res.description });
      },
    });
  };

  const handleAlgoChange = (id: AlgorithmId) => {
    setAlgo(id);
    setKey("");
    setOutput("");
    setProcessingTime(null);
    setFileResult(null);
    setSelectedFile(null);
  };

  const runFileOperation = useCallback(async () => {
    if (!selectedFile) return;
    if (selectedAlgo.requiresKey && !key.trim()) return;
    setFileResult(null);
    if (mode === "encrypt") {
      const buffer = await selectedFile.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      }
      const base64 = btoa(binary);
      encryptMutation.mutate(
        { data: { text: base64, algorithm: algo as any, key: selectedAlgo.requiresKey ? key : undefined, shift: selectedAlgo.requiresShift ? shift : undefined } },
        {
          onSuccess: (res) => {
            setFileResult({ data: res.encrypted, downloadName: selectedFile.name + ".enc" });
            setProcessingTime(res.processingTime);
          },
          onError: (err: any) => toast({ description: err?.data?.error || "Encryption failed" }),
        },
      );
    } else {
      const text = await selectedFile.text();
      decryptMutation.mutate(
        { data: { text, algorithm: algo as any, key: selectedAlgo.requiresKey ? key : undefined, shift: selectedAlgo.requiresShift ? shift : undefined } },
        {
          onSuccess: (res) => {
            setFileResult({ data: res.decrypted, downloadName: selectedFile.name.replace(/\.enc$/, "") || "decrypted-file" });
            setProcessingTime(res.processingTime);
          },
          onError: (err: any) => toast({ description: err?.data?.error || "Decryption failed — check key or algorithm" }),
        },
      );
    }
  }, [selectedFile, algo, key, shift, mode, selectedAlgo, encryptMutation, decryptMutation, toast]);

  const downloadFileResult = () => {
    if (!fileResult) return;
    let blob: Blob;
    if (mode === "decrypt") {
      try {
        const binary = atob(fileResult.data);
        const bytes = Uint8Array.from({ length: binary.length }, (_, i) => binary.charCodeAt(i));
        blob = new Blob([bytes]);
      } catch {
        blob = new Blob([fileResult.data], { type: "text/plain" });
      }
    } else {
      blob = new Blob([fileResult.data], { type: "application/octet-stream" });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileResult.downloadName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setSelectedFile(file); setFileResult(null); }
  };

  const outputIsError = output.startsWith("ERROR:");

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-3">
            <Lock className="w-6 h-6" />
            WORKSPACE
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time cryptographic operations. Select an algorithm, enter text, watch it transform.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex bg-secondary p-1 rounded-lg border border-border gap-1">
            <button
              onClick={() => { setMode("encrypt"); setFileResult(null); }}
              className={`px-5 py-2 rounded-md font-mono text-xs font-bold transition-all flex items-center gap-2 ${mode === "encrypt" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Lock className="w-3.5 h-3.5" /> ENCRYPT
            </button>
            <button
              onClick={() => { setMode("decrypt"); setFileResult(null); }}
              className={`px-5 py-2 rounded-md font-mono text-xs font-bold transition-all flex items-center gap-2 ${mode === "decrypt" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Unlock className="w-3.5 h-3.5" /> DECRYPT
            </button>
          </div>
          <div className="flex bg-secondary p-1 rounded-lg border border-border gap-1">
            <button
              onClick={() => { setInputMode("text"); setSelectedFile(null); setFileResult(null); }}
              className={`px-4 py-1.5 rounded-md font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${inputMode === "text" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <FileText className="w-3 h-3" /> TEXT
            </button>
            <button
              onClick={() => { setInputMode("file"); setInput(""); setOutput(""); setProcessingTime(null); setFileResult(null); }}
              className={`px-4 py-1.5 rounded-md font-mono text-xs font-bold transition-all flex items-center gap-1.5 ${inputMode === "file" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Upload className="w-3 h-3" /> FILE
            </button>
          </div>
        </div>
      </div>

      {/* Algorithm Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {algorithms.map((a) => (
          <div
            key={a.id}
            onClick={() => handleAlgoChange(a.id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all select-none ${
              algo === a.id
                ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(0,255,255,0.08)]"
                : "border-border bg-card hover:border-border/80 hover:bg-card/80"
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono font-bold text-base">{a.name}</span>
              <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${securityBadge[a.securityLevel]}`}>
                {a.securityLevel}
              </span>
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">{a.desc}</div>
            {a.bits && (
              <div className="mt-2 text-[10px] font-mono text-muted-foreground/70">
                Key strength: {a.bits}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Algorithm Info Panel */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            <Info className="w-4 h-4 text-primary" />
            {selectedAlgo.name} — Details & Use Cases
          </span>
          {showInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs font-mono text-muted-foreground mb-1">SECURITY LEVEL</div>
                  <div className={`font-bold font-mono ${selectedAlgo.securityColor}`}>{selectedAlgo.securityLevel}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Bit strength: {selectedAlgo.bits}</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground mb-1">TYPICAL USE CASE</div>
                  <div className="text-foreground font-mono text-xs">{selectedAlgo.useCase}</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground mb-1">KEY INFO</div>
                  <div className="text-foreground font-mono text-xs">{selectedAlgo.keyNote}</div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_160px_1fr] gap-4" style={{ minHeight: 360 }}>
        {/* Input Panel */}
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-muted-foreground">
                {inputMode === "file"
                  ? (mode === "encrypt" ? "FILE INPUT" : "ENCRYPTED FILE INPUT")
                  : (mode === "encrypt" ? "PLAINTEXT INPUT" : "CIPHERTEXT INPUT")}
              </span>
              {inputMode === "text" && input && (
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {input.length} chars
                </span>
              )}
              {inputMode === "file" && selectedFile && (
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              )}
            </div>
            {inputMode === "text" ? (
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => handleCopy(input, "Input")}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            ) : selectedFile ? (
              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => { setSelectedFile(null); setFileResult(null); }}>
                <X className="w-3.5 h-3.5" />
              </Button>
            ) : null}
          </div>
          {inputMode === "text" ? (
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === "encrypt" ? "Type or paste plaintext here..." : "Paste ciphertext to decrypt..."}
              className="flex-1 bg-transparent p-4 resize-none outline-none font-mono text-sm placeholder:text-muted-foreground/40"
              style={{ minHeight: 280 }}
            />
          ) : (
            <div className="flex-1 flex flex-col" style={{ minHeight: 280 }}>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setSelectedFile(f); setFileResult(null); }
                  e.target.value = "";
                }}
              />
              {selectedFile ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-primary/60" />
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-foreground truncate max-w-[200px]">{selectedFile.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">{(selectedFile.size / 1024).toFixed(2)} KB · {selectedFile.type || "unknown type"}</div>
                  </div>
                  <Button
                    className="w-full font-mono text-xs h-9"
                    onClick={runFileOperation}
                    disabled={isPending || (selectedAlgo.requiresKey && !key.trim())}
                  >
                    {isPending
                      ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Processing...</>
                      : mode === "encrypt"
                        ? <><Lock className="w-3.5 h-3.5 mr-2" /> Encrypt File</>
                        : <><Unlock className="w-3.5 h-3.5 mr-2" /> Decrypt File</>}
                  </Button>
                </div>
              ) : (
                <div
                  className={`flex-1 flex flex-col items-center justify-center gap-3 p-6 cursor-pointer transition-colors ${isDragging ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`w-14 h-14 rounded-2xl border-2 border-dashed flex items-center justify-center transition-colors ${isDragging ? "border-primary text-primary" : "border-border text-muted-foreground/40"}`}>
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-mono text-muted-foreground">Drop a file or click to browse</div>
                    <div className="text-[11px] text-muted-foreground/50 mt-1">Any file type · Max 10 MB</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Column */}
        <div className="flex flex-col items-center justify-center gap-4">
          {/* Swap button */}
          <button
            onClick={handleSwap}
            disabled={inputMode === "file" || !output || outputIsError}
            title="Swap input/output and flip mode"
            className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-primary transition-all hover:border-primary/50 hover:shadow-[0_0_15px_rgba(0,255,255,0.15)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>

          {/* Key Input */}
          {selectedAlgo.requiresKey && (
            <div className="bg-card border border-primary/40 rounded-xl p-4 w-full flex flex-col gap-3 shadow-[0_0_15px_rgba(0,255,255,0.05)]">
              <div className="text-[10px] font-mono text-primary flex items-center gap-1.5">
                <Key className="w-3 h-3" /> SECRET KEY
              </div>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono w-full outline-none focus:border-primary transition-colors"
                placeholder="Enter passphrase..."
              />
              {key && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        key.length < 8 ? "bg-red-500 w-1/4"
                        : key.length < 16 ? "bg-yellow-500 w-1/2"
                        : key.length < 32 ? "bg-emerald-500 w-3/4"
                        : "bg-emerald-400 w-full"
                      }`}
                    />
                  </div>
                  <span className={`text-[9px] font-mono ${
                    key.length < 8 ? "text-red-400" : key.length < 16 ? "text-yellow-400" : "text-emerald-400"
                  }`}>
                    {key.length < 8 ? "WEAK" : key.length < 16 ? "FAIR" : key.length < 32 ? "STRONG" : "VAULT"}
                  </span>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 font-mono border-primary/30 hover:border-primary/60"
                onClick={generateNewKey}
                disabled={generateKeyMutation.isPending}
              >
                {generateKeyMutation.isPending
                  ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  : <RefreshCw className="w-3 h-3 mr-1.5" />}
                Generate
              </Button>
            </div>
          )}

          {/* Shift Input for Caesar */}
          {selectedAlgo.requiresShift && (
            <div className="bg-card border border-border rounded-xl p-4 w-full flex flex-col gap-3">
              <div className="text-[10px] font-mono text-muted-foreground">SHIFT VALUE</div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold font-mono text-primary w-8 text-center">{shift}</span>
                <input
                  type="range"
                  min={1}
                  max={25}
                  value={shift}
                  onChange={(e) => setShift(Number(e.target.value))}
                  className="flex-1 accent-cyan-400"
                />
              </div>
              <div className="text-[9px] font-mono text-muted-foreground/60">
                '{String.fromCharCode(65)}' → '{String.fromCharCode(65 + shift <= 90 ? 65 + shift : 65 + shift - 26)}'&nbsp;&nbsp;
                '{String.fromCharCode(97)}' → '{String.fromCharCode(97 + shift <= 122 ? 97 + shift : 97 + shift - 26)}'
              </div>
            </div>
          )}

          {/* Processing indicator */}
          {processingTime !== null && !isPending && (
            <div className="text-[10px] font-mono text-muted-foreground/60 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {processingTime.toFixed(1)}ms
            </div>
          )}
          {isPending && (
            <div className="text-[10px] font-mono text-primary/60 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> processing...
            </div>
          )}
        </div>

        {/* Output Panel */}
        <div className={`rounded-xl flex flex-col overflow-hidden border ${
          outputIsError && inputMode === "text"
            ? "border-red-700/50 bg-red-950/10"
            : "border-primary/30 bg-card shadow-[0_0_25px_rgba(0,255,255,0.04)]"
        }`}>
          <div className={`flex items-center justify-between px-4 py-3 border-b ${outputIsError && inputMode === "text" ? "border-red-700/30 bg-red-950/20" : "border-primary/20 bg-primary/5"}`}>
            <div className="flex items-center gap-2">
              {outputIsError && inputMode === "text"
                ? <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                : <CheckCircle2 className={`w-3.5 h-3.5 ${(inputMode === "text" ? output : fileResult) ? "text-emerald-400" : "text-muted-foreground/30"}`} />}
              <span className={`font-mono text-xs font-bold ${outputIsError && inputMode === "text" ? "text-red-400" : "text-primary"}`}>
                {inputMode === "file"
                  ? (mode === "encrypt" ? "ENCRYPTED FILE OUTPUT" : "DECRYPTED FILE OUTPUT")
                  : (mode === "encrypt" ? "CIPHERTEXT OUTPUT" : "PLAINTEXT OUTPUT")}
              </span>
              {inputMode === "text" && output && !outputIsError && (
                <span className="text-[10px] font-mono text-muted-foreground/60">
                  {output.length} chars
                </span>
              )}
            </div>
            {inputMode === "text" && (
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-primary hover:bg-primary/20"
                onClick={() => handleCopy(output, "Output")}
                disabled={!output || outputIsError}
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
          {inputMode === "file" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6" style={{ minHeight: 280 }}>
              {isPending ? (
                <div className="flex flex-col items-center gap-3 text-primary/60">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-mono">{mode === "encrypt" ? "Encrypting..." : "Decrypting..."}</span>
                </div>
              ) : fileResult ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-900/30 border border-emerald-700/40 flex items-center justify-center">
                    <FileDown className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div className="text-center">
                    <div className="font-mono text-sm font-bold text-emerald-400">
                      {mode === "encrypt" ? "File encrypted!" : "File decrypted!"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate max-w-[200px]">{fileResult.downloadName}</div>
                  </div>
                  <Button
                    className="w-full font-mono text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                    onClick={downloadFileResult}
                  >
                    <FileDown className="w-3.5 h-3.5 mr-2" /> Download
                  </Button>
                </>
              ) : (
                <div className="text-center text-muted-foreground/40">
                  <FileDown className="w-10 h-10 mx-auto mb-2" />
                  <div className="text-xs font-mono">
                    {selectedAlgo.requiresKey && !key ? "// Enter a key to proceed" : "// Result will appear here"}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-auto font-mono text-sm break-all relative" style={{ minHeight: 280 }}>
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={output.slice(0, 40)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className={outputIsError ? "text-red-400" : output ? "text-primary" : "text-primary/25"}
                >
                  {output || (
                    selectedAlgo.requiresKey && !key
                      ? "// Enter a key to begin..."
                      : `// ${mode === "encrypt" ? "Encrypted" : "Decrypted"} output will appear here`
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
          {((inputMode === "text" && output && !outputIsError && input) || (inputMode === "file" && fileResult)) && (
            <div className="px-4 py-2 border-t border-primary/10 flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {inputMode === "text"
                  ? `Size ratio: ${(output.length / input.length).toFixed(2)}x`
                  : processingTime !== null ? `${processingTime.toFixed(1)}ms` : ""}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/50">
                ALGO: {algo}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
