import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageIcon, Lock, Unlock, Download, Upload, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── LSB Steganography (client-side, Canvas API) ──────────────────────────────
// Encodes each character as 8 bits, stored 1 bit per pixel channel (R only).
// Header: first 32 pixels store message length as uint32.

const BITS_PER_PIXEL = 1; // using only red channel LSB

function encodeMessage(imageData: ImageData, message: string): ImageData | null {
  const msgBytes = new TextEncoder().encode(message);
  const totalBits = 32 + msgBytes.length * 8; // 32-bit length header + data
  const maxBits = Math.floor((imageData.data.length / 4) * BITS_PER_PIXEL);

  if (totalBits > maxBits) return null; // image too small

  const data = new Uint8ClampedArray(imageData.data);
  let bitIndex = 0;

  const writeBit = (bit: number) => {
    const pixelIndex = Math.floor(bitIndex / BITS_PER_PIXEL);
    const channel = bitIndex % BITS_PER_PIXEL; // 0 = R
    const byteIndex = pixelIndex * 4 + channel;
    data[byteIndex] = (data[byteIndex] & 0xfe) | (bit & 1);
    bitIndex++;
  };

  // Write 32-bit length header (big-endian)
  const len = msgBytes.length;
  for (let i = 31; i >= 0; i--) writeBit((len >> i) & 1);

  // Write message bytes
  for (const byte of msgBytes) {
    for (let i = 7; i >= 0; i--) writeBit((byte >> i) & 1);
  }

  return new ImageData(data, imageData.width, imageData.height);
}

function decodeMessage(imageData: ImageData): string | null {
  const data = imageData.data;
  let bitIndex = 0;

  const readBit = (): number => {
    const pixelIndex = Math.floor(bitIndex / BITS_PER_PIXEL);
    const channel = bitIndex % BITS_PER_PIXEL;
    const byteIndex = pixelIndex * 4 + channel;
    bitIndex++;
    return data[byteIndex] & 1;
  };

  // Read 32-bit length
  let len = 0;
  for (let i = 31; i >= 0; i--) len |= readBit() << i;

  if (len <= 0 || len > 1_000_000) return null; // sanity check

  const maxBits = Math.floor((data.length / 4) * BITS_PER_PIXEL);
  if (32 + len * 8 > maxBits) return null;

  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    let byte = 0;
    for (let j = 7; j >= 0; j--) byte |= readBit() << j;
    bytes[i] = byte;
  }

  try {
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function loadImageData(file: File): Promise<{ imageData: ImageData; canvas: HTMLCanvasElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve({ imageData: ctx.getImageData(0, 0, canvas.width, canvas.height), canvas });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StegoPage() {
  const { toast } = useToast();

  // Encode state
  const [encodeFile, setEncodeFile] = useState<File | null>(null);
  const [encodePreview, setEncodePreview] = useState<string>("");
  const [message, setMessage] = useState("");
  const [encoding, setEncoding] = useState(false);
  const [encodeResult, setEncodeResult] = useState<string>("");

  // Decode state
  const [decodeFile, setDecodeFile] = useState<File | null>(null);
  const [decodePreview, setDecodePreview] = useState<string>("");
  const [decoded, setDecoded] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [showDecoded, setShowDecoded] = useState(false);

  const encodeFileRef = useRef<HTMLInputElement>(null);
  const decodeFileRef = useRef<HTMLInputElement>(null);

  const maxCapacity = useCallback((file: File | null): string => {
    if (!file) return "—";
    // rough estimate: width * height / 8 bytes
    return "depends on image size";
  }, []);

  // ── Encode ──
  const handleEncodeFile = (f: File) => {
    setEncodeFile(f);
    setEncodeResult("");
    const url = URL.createObjectURL(f);
    setEncodePreview(url);
  };

  const runEncode = async () => {
    if (!encodeFile || !message.trim()) return;
    setEncoding(true);
    try {
      const { imageData, canvas } = await loadImageData(encodeFile);
      const maxCapacityBytes = Math.floor((imageData.data.length / 4) * BITS_PER_PIXEL / 8) - 4;
      const msgBytes = new TextEncoder().encode(message).length;
      if (msgBytes > maxCapacityBytes) {
        toast({ description: `Message too long. Max capacity: ${maxCapacityBytes} bytes for this image.` });
        setEncoding(false);
        return;
      }
      const encoded = encodeMessage(imageData, message);
      if (!encoded) {
        toast({ description: "Image too small to hold this message." });
        setEncoding(false);
        return;
      }
      const ctx = canvas.getContext("2d")!;
      ctx.putImageData(encoded, 0, 0);
      const dataUrl = canvas.toDataURL("image/png");
      setEncodeResult(dataUrl);
    } catch (err) {
      toast({ description: "Failed to encode message into image." });
    }
    setEncoding(false);
  };

  const downloadResult = () => {
    if (!encodeResult) return;
    const a = document.createElement("a");
    a.href = encodeResult;
    a.download = `stego-${encodeFile?.name?.replace(/\.[^.]+$/, "") ?? "image"}.png`;
    a.click();
  };

  // ── Decode ──
  const handleDecodeFile = (f: File) => {
    setDecodeFile(f);
    setDecoded(null);
    const url = URL.createObjectURL(f);
    setDecodePreview(url);
  };

  const runDecode = async () => {
    if (!decodeFile) return;
    setDecoding(true);
    try {
      const { imageData } = await loadImageData(decodeFile);
      const result = decodeMessage(imageData);
      if (result === null || result.trim() === "") {
        setDecoded("__NONE__");
      } else {
        setDecoded(result);
      }
    } catch {
      toast({ description: "Failed to read image." });
    }
    setDecoding(false);
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-3">
          <Eye className="w-6 h-6" />
          STEGANOGRAPHY
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Hide secret messages inside PNG images using LSB (Least Significant Bit) steganography. The image looks identical to the naked eye.
        </p>
      </div>

      {/* How it works banner */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-5 py-4 flex flex-wrap gap-6 text-xs font-mono">
        {[
          { step: "01", title: "SELECT IMAGE", desc: "Upload any PNG/JPG" },
          { step: "02", title: "ENTER MESSAGE", desc: "Your secret text" },
          { step: "03", title: "ENCODE", desc: "LSB bits modified" },
          { step: "04", title: "DOWNLOAD", desc: "Visually unchanged PNG" },
          { step: "05", title: "DECODE", desc: "Extract message later" },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-2">
            <span className="text-primary/40 text-[10px] mt-0.5">{s.step}</span>
            <div>
              <div className="text-primary font-bold">{s.title}</div>
              <div className="text-muted-foreground/60">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Encode ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <div>
              <h2 className="font-mono font-bold text-sm">HIDE MESSAGE IN IMAGE</h2>
              <p className="text-xs text-muted-foreground">Encode secret text into the LSBs of pixel data</p>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-4 flex-1">
            <input
              type="file"
              ref={encodeFileRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleEncodeFile(f); e.target.value = ""; }}
            />
            {encodeFile ? (
              <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/20 aspect-video flex items-center justify-center">
                <img src={encodePreview} alt="cover" className="max-h-full max-w-full object-contain" />
                <button
                  onClick={() => { setEncodeFile(null); setEncodePreview(""); setEncodeResult(""); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                >×</button>
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded">
                  {encodeFile.name} · {(encodeFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ) : (
              <div
                onClick={() => encodeFileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl aspect-video flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs font-mono text-muted-foreground">Upload cover image (PNG/JPG)</span>
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your secret message..."
              rows={4}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 resize-none font-mono text-sm outline-none focus:border-primary transition-colors"
            />

            {message && encodeFile && (
              <div className="text-[10px] font-mono text-muted-foreground/60">
                Message size: {new TextEncoder().encode(message).length} bytes
              </div>
            )}

            <Button
              onClick={runEncode}
              disabled={!encodeFile || !message.trim() || encoding}
              className="w-full font-mono text-xs h-9"
            >
              {encoding
                ? <><ImageIcon className="w-3.5 h-3.5 mr-2 animate-pulse" /> Encoding...</>
                : <><Lock className="w-3.5 h-3.5 mr-2" /> Encode & Hide Message</>}
            </Button>

            <AnimatePresence>
              {encodeResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-3"
                >
                  <div className="relative rounded-xl overflow-hidden border border-emerald-700/40 bg-emerald-900/10">
                    <img src={encodeResult} alt="stego" className="w-full object-contain max-h-48" />
                    <div className="absolute top-2 left-2 bg-emerald-900/80 text-emerald-400 text-[10px] font-mono px-2 py-1 rounded">
                      MESSAGE HIDDEN ✓
                    </div>
                  </div>
                  <Button onClick={downloadResult} className="w-full font-mono text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                    <Download className="w-3.5 h-3.5 mr-2" /> Download Stego Image
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Decode ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center gap-2">
            <Unlock className="w-4 h-4 text-primary" />
            <div>
              <h2 className="font-mono font-bold text-sm">EXTRACT HIDDEN MESSAGE</h2>
              <p className="text-xs text-muted-foreground">Reveal text concealed in a stego image</p>
            </div>
          </div>
          <div className="p-5 flex flex-col gap-4 flex-1">
            <input
              type="file"
              ref={decodeFileRef}
              className="hidden"
              accept="image/png"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDecodeFile(f); e.target.value = ""; }}
            />
            {decodeFile ? (
              <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/20 aspect-video flex items-center justify-center">
                <img src={decodePreview} alt="stego" className="max-h-full max-w-full object-contain" />
                <button
                  onClick={() => { setDecodeFile(null); setDecodePreview(""); setDecoded(null); }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                >×</button>
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-mono px-2 py-1 rounded">
                  {decodeFile.name} · {(decodeFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ) : (
              <div
                onClick={() => decodeFileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl aspect-video flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-primary/3 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground/30" />
                <span className="text-xs font-mono text-muted-foreground">Upload stego image (PNG only)</span>
                <span className="text-[10px] font-mono text-muted-foreground/50">Must be the original PNG — not re-compressed</span>
              </div>
            )}

            <Button
              onClick={runDecode}
              disabled={!decodeFile || decoding}
              className="w-full font-mono text-xs h-9"
            >
              {decoding
                ? <><Eye className="w-3.5 h-3.5 mr-2 animate-pulse" /> Scanning...</>
                : <><Unlock className="w-3.5 h-3.5 mr-2" /> Extract Hidden Message</>}
            </Button>

            <AnimatePresence>
              {decoded !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {decoded === "__NONE__" ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-yellow-700/40 bg-yellow-900/10 text-yellow-400 font-mono text-sm">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      No hidden message found in this image.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" /> HIDDEN MESSAGE FOUND
                        </div>
                        <button onClick={() => setShowDecoded((v) => !v)} className="text-muted-foreground hover:text-foreground transition-colors">
                          {showDecoded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className={`bg-background border border-emerald-700/30 rounded-xl px-4 py-3 font-mono text-sm text-foreground break-words min-h-[80px] transition-all ${showDecoded ? "" : "blur-sm select-none"}`}>
                        {decoded}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex-1 h-8 font-mono border-primary/30"
                          onClick={() => { navigator.clipboard.writeText(decoded); toast({ description: "Message copied" }); }}
                        >
                          Copy Message
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs flex-1 h-8 font-mono"
                          onClick={() => setShowDecoded((v) => !v)}
                        >
                          {showDecoded ? "Hide" : "Reveal"}
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
