import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hash, Copy, Upload, FileText, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── Algorithms ───────────────────────────────────────────────────────────────

type HashAlgo = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" | "MD5";

const ALGOS: { id: HashAlgo; label: string; bits: number; note: string; safe: boolean }[] = [
  { id: "MD5",     label: "MD5",     bits: 128, note: "Broken — collisions found. Legacy only.", safe: false },
  { id: "SHA-1",   label: "SHA-1",   bits: 160, note: "Deprecated by NIST. Avoid for security.",  safe: false },
  { id: "SHA-256", label: "SHA-256", bits: 256, note: "Widely used. Secure for most purposes.",    safe: true  },
  { id: "SHA-384", label: "SHA-384", bits: 384, note: "Stronger SHA-2 variant. Good for TLS.",    safe: true  },
  { id: "SHA-512", label: "SHA-512", bits: 512, note: "Maximum SHA-2 strength. Slower on 32-bit.", safe: true  },
];

// ─── MD5 (pure JS — SubtleCrypto doesn't support it) ─────────────────────────

function md5(input: Uint8Array): string {
  const T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  const S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  const msgLen = input.length;
  const bitLen = msgLen * 8;
  const extra = (56 - ((msgLen + 1) % 64) + 64) % 64;
  const padded = new Uint8Array(msgLen + 1 + extra + 8);
  padded.set(input);
  padded[msgLen] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let i = 0; i < padded.length; i += 64) {
    const M = Array.from({ length: 16 }, (_, j) => view.getUint32(i + j * 4, true));
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let j = 0; j < 64; j++) {
      let f: number, g: number;
      if (j < 16)       { f = (b & c) | (~b & d); g = j; }
      else if (j < 32)  { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48)  { f = b ^ c ^ d;           g = (3 * j + 5) % 16; }
      else              { f = c ^ (b | ~d);         g = (7 * j) % 16; }
      f = (f + a + T[j] + M[g]) >>> 0;
      a = d; d = c; c = b;
      b = (b + ((f << S[j]) | (f >>> (32 - S[j])))) >>> 0;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map((v) => {
    const dv = new DataView(new ArrayBuffer(4));
    dv.setUint32(0, v, true);
    return Array.from(new Uint8Array(dv.buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }).join("");
}

async function computeHash(data: ArrayBuffer, algo: HashAlgo): Promise<string> {
  if (algo === "MD5") return md5(new Uint8Array(data));
  const hashBuf = await crypto.subtle.digest(algo, data);
  return Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashAll(data: ArrayBuffer): Promise<Record<HashAlgo, string>> {
  const results = await Promise.all(ALGOS.map(async (a) => [a.id, await computeHash(data, a.id)] as const));
  return Object.fromEntries(results) as Record<HashAlgo, string>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HashPage() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [hashes, setHashes] = useState<Record<HashAlgo, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAlgo, setSelectedAlgo] = useState<HashAlgo>("SHA-256");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileHashes, setFileHashes] = useState<Record<HashAlgo, string> | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const runHash = useCallback(async (value: string) => {
    if (!value) { setHashes(null); return; }
    setLoading(true);
    const enc = new TextEncoder().encode(value);
    const result = await hashAll(enc.buffer as ArrayBuffer);
    setHashes(result);
    setLoading(false);
  }, []);

  const handleTextChange = (v: string) => {
    setText(v);
    runHash(v);
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setFileHashes(null);
    setFileLoading(true);
    const buf = await f.arrayBuffer();
    const result = await hashAll(buf);
    setFileHashes(result);
    setFileLoading(false);
  };

  const copy = (val: string, label: string) => {
    navigator.clipboard.writeText(val);
    toast({ description: `${label} copied` });
  };

  const compareMatch =
    compareA.trim() && compareB.trim()
      ? compareA.trim().toLowerCase() === compareB.trim().toLowerCase()
      : null;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-3">
          <Hash className="w-6 h-6" />
          HASH GENERATOR
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes for text or files. Verify integrity with the hash comparator.
        </p>
      </div>

      {/* Algorithm selector */}
      <div className="grid grid-cols-5 gap-2">
        {ALGOS.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelectedAlgo(a.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              selectedAlgo === a.id
                ? "border-primary bg-primary/5 shadow-[0_0_15px_rgba(0,255,255,0.08)]"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <div className="font-mono font-bold text-sm">{a.label}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{a.bits}-bit</div>
            <div className={`text-[9px] mt-1 font-mono ${a.safe ? "text-emerald-400" : "text-red-400"}`}>
              {a.safe ? "SECURE" : "BROKEN"}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Text Hashing ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-secondary/30">
            <h2 className="font-mono font-bold text-sm">TEXT HASHING</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Type or paste any text to hash it instantly</p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Enter text to hash..."
              className="w-full bg-background border border-border rounded-lg px-4 py-3 resize-none font-mono text-sm outline-none focus:border-primary transition-colors"
              rows={4}
            />
            <AnimatePresence>
              {hashes && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2"
                >
                  {ALGOS.map((a) => (
                    <div
                      key={a.id}
                      className={`group flex items-stretch gap-0 rounded-lg border overflow-hidden transition-colors ${
                        selectedAlgo === a.id ? "border-primary/50" : "border-border"
                      }`}
                    >
                      <div className={`px-3 py-2 font-mono text-[10px] font-bold flex items-center min-w-[64px] ${
                        selectedAlgo === a.id ? "bg-primary/10 text-primary" : "bg-secondary/50 text-muted-foreground"
                      }`}>
                        {a.id}
                      </div>
                      <div className="flex-1 px-3 py-2 font-mono text-[10px] text-muted-foreground/80 break-all bg-background">
                        {hashes[a.id]}
                      </div>
                      <button
                        onClick={() => copy(hashes[a.id], `${a.id} hash`)}
                        className="px-2 bg-secondary/30 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            {loading && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                <RefreshCw className="w-3 h-3 animate-spin" /> Computing...
              </div>
            )}
          </div>
        </div>

        {/* ── File Hashing ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-secondary/30">
            <h2 className="font-mono font-bold text-sm">FILE INTEGRITY</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Verify file integrity by comparing hashes</p>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <input type="file" ref={fileRef} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            {file ? (
              <div className="flex items-center gap-3 bg-secondary/40 rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-primary/60 shrink-0" />
                <div className="min-w-0">
                  <div className="font-mono text-xs font-bold truncate">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</div>
                </div>
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-7" onClick={() => { setFile(null); setFileHashes(null); }}>
                  Clear
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs font-mono text-muted-foreground">Drop a file or click to browse</span>
              </div>
            )}

            {fileLoading && (
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground/60">
                <RefreshCw className="w-3 h-3 animate-spin" /> Hashing file...
              </div>
            )}

            <AnimatePresence>
              {fileHashes && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2"
                >
                  {ALGOS.map((a) => (
                    <div
                      key={a.id}
                      className={`group flex items-stretch gap-0 rounded-lg border overflow-hidden transition-colors ${
                        selectedAlgo === a.id ? "border-primary/50" : "border-border"
                      }`}
                    >
                      <div className={`px-3 py-2 font-mono text-[10px] font-bold flex items-center min-w-[64px] ${
                        selectedAlgo === a.id ? "bg-primary/10 text-primary" : "bg-secondary/50 text-muted-foreground"
                      }`}>
                        {a.id}
                      </div>
                      <div className="flex-1 px-3 py-2 font-mono text-[10px] text-muted-foreground/80 break-all bg-background">
                        {fileHashes[a.id]}
                      </div>
                      <button
                        onClick={() => copy(fileHashes[a.id], `${a.id} hash`)}
                        className="px-2 bg-secondary/30 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Hash Comparator ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-secondary/30">
          <h2 className="font-mono font-bold text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            HASH COMPARATOR
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Paste two hashes to verify they match — useful for download integrity checks</p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-muted-foreground">HASH A (expected)</label>
              <input
                value={compareA}
                onChange={(e) => setCompareA(e.target.value)}
                placeholder="Paste expected hash..."
                className="bg-background border border-border rounded-lg px-4 py-3 font-mono text-xs outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-mono text-muted-foreground">HASH B (computed)</label>
              <input
                value={compareB}
                onChange={(e) => setCompareB(e.target.value)}
                placeholder="Paste computed hash..."
                className="bg-background border border-border rounded-lg px-4 py-3 font-mono text-xs outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
          <AnimatePresence>
            {compareMatch !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border font-mono text-sm font-bold ${
                  compareMatch
                    ? "bg-emerald-900/20 border-emerald-700/40 text-emerald-400"
                    : "bg-red-900/20 border-red-700/40 text-red-400"
                }`}
              >
                {compareMatch
                  ? <><CheckCircle2 className="w-5 h-5" /> MATCH — hashes are identical</>
                  : <><AlertCircle className="w-5 h-5" /> MISMATCH — hashes differ</>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
