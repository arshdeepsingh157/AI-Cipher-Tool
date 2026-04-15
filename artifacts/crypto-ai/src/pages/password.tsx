import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, ShieldX, ShieldAlert, RefreshCw, Copy, Eye, EyeOff,
  CheckCircle2, XCircle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ─── Strength analysis ────────────────────────────────────────────────────────

interface AnalysisResult {
  score: number; // 0–100
  label: "Terrible" | "Weak" | "Fair" | "Strong" | "Vault-grade";
  color: string;
  barColor: string;
  entropy: number;
  timeToCrack: string;
  checks: { label: string; pass: boolean }[];
}

function analyzePassword(pwd: string): AnalysisResult {
  const checks = [
    { label: "At least 8 characters", pass: pwd.length >= 8 },
    { label: "At least 12 characters", pass: pwd.length >= 12 },
    { label: "Uppercase letters (A–Z)", pass: /[A-Z]/.test(pwd) },
    { label: "Lowercase letters (a–z)", pass: /[a-z]/.test(pwd) },
    { label: "Numbers (0–9)", pass: /[0-9]/.test(pwd) },
    { label: "Special characters (!@#…)", pass: /[^A-Za-z0-9]/.test(pwd) },
    { label: "No common patterns (123, abc…)", pass: !/123|abc|qwerty|password|111|000/i.test(pwd) },
    { label: "No keyboard walks (asdf, qwer…)", pass: !/asdf|zxcv|qwer|poiu/i.test(pwd) },
  ];

  // Entropy = log2(charsetSize ^ length)
  let charsetSize = 0;
  if (/[a-z]/.test(pwd)) charsetSize += 26;
  if (/[A-Z]/.test(pwd)) charsetSize += 26;
  if (/[0-9]/.test(pwd)) charsetSize += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) charsetSize += 32;
  const entropy = charsetSize > 0 ? Math.round(pwd.length * Math.log2(charsetSize)) : 0;

  // Rough crack time (10B guesses/s GPU)
  const combinations = charsetSize > 0 ? Math.pow(charsetSize, pwd.length) : 1;
  const secondsToCrack = combinations / 1e10;
  const timeToCrack = (() => {
    if (secondsToCrack < 1) return "Instant";
    if (secondsToCrack < 60) return `${Math.round(secondsToCrack)} seconds`;
    if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
    if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
    if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 86400)} days`;
    if (secondsToCrack < 31536000 * 1000) return `${Math.round(secondsToCrack / 31536000)} years`;
    if (secondsToCrack < 31536000 * 1e9) return `${(secondsToCrack / 31536000 / 1e6).toFixed(1)}M years`;
    return "Heat death of universe";
  })();

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.min(100, Math.round((entropy / 80) * 100));

  const label: AnalysisResult["label"] =
    pwd.length === 0 ? "Terrible" :
    score < 25 ? "Terrible" :
    score < 45 ? "Weak" :
    score < 65 ? "Fair" :
    score < 85 ? "Strong" : "Vault-grade";

  const colorMap: Record<AnalysisResult["label"], string> = {
    Terrible: "text-red-400",
    Weak: "text-orange-400",
    Fair: "text-yellow-400",
    Strong: "text-emerald-400",
    "Vault-grade": "text-cyan-400",
  };
  const barColorMap: Record<AnalysisResult["label"], string> = {
    Terrible: "bg-red-500",
    Weak: "bg-orange-500",
    Fair: "bg-yellow-500",
    Strong: "bg-emerald-500",
    "Vault-grade": "bg-cyan-400",
  };

  return { score, label, color: colorMap[label], barColor: barColorMap[label], entropy, timeToCrack, checks };
}

// ─── Generator ────────────────────────────────────────────────────────────────

interface GenOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

function generatePassword(opts: GenOptions): string {
  let charset = "";
  if (opts.upper) charset += opts.excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (opts.lower) charset += opts.excludeAmbiguous ? "abcdefghjkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
  if (opts.numbers) charset += opts.excludeAmbiguous ? "23456789" : "0123456789";
  if (opts.symbols) charset += "!@#$%^&*()-_=+[]{}|;:,.<>?";
  if (!charset) charset = "abcdefghijklmnopqrstuvwxyz";

  const array = new Uint32Array(opts.length);
  crypto.getRandomValues(array);
  return Array.from(array, (n) => charset[n % charset.length]).join("");
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PasswordPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [genOpts, setGenOpts] = useState<GenOptions>({
    length: 20,
    upper: true,
    lower: true,
    numbers: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [generated, setGenerated] = useState(() => generatePassword({
    length: 20, upper: true, lower: true, numbers: true, symbols: true, excludeAmbiguous: false,
  }));

  const analysis = analyzePassword(input);
  const genAnalysis = analyzePassword(generated);

  const handleGenerate = useCallback(() => {
    setGenerated(generatePassword(genOpts));
  }, [genOpts]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: `${label} copied to clipboard` });
  };

  const toggle = (key: keyof GenOptions) =>
    setGenOpts((o) => ({ ...o, [key]: !o[key as keyof GenOptions] }));

  const shieldIcon =
    analysis.label === "Vault-grade" || analysis.label === "Strong" ? ShieldCheck :
    analysis.label === "Fair" ? ShieldAlert : ShieldX;
  const ShieldIcon = shieldIcon;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-3">
          <ShieldCheck className="w-6 h-6" />
          PASSWORD TOOLS
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Analyze password strength with entropy scoring, crack-time estimates, and a cryptographically secure generator.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Analyzer ── */}
        <div className="bg-card border border-border rounded-xl flex flex-col gap-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-secondary/30">
            <h2 className="font-mono font-bold text-sm text-foreground flex items-center gap-2">
              <ShieldIcon className={`w-4 h-4 ${analysis.label === "Terrible" || analysis.label === "Weak" ? "text-red-400" : analysis.color}`} />
              STRENGTH ANALYZER
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enter any password to analyze it instantly</p>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* Password input */}
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a password to analyze..."
                className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-10 font-mono text-sm outline-none focus:border-primary transition-colors"
              />
              <button
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Score bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className={`font-mono font-bold text-sm ${input ? analysis.color : "text-muted-foreground/40"}`}>
                  {input ? analysis.label.toUpperCase() : "ENTER A PASSWORD"}
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  {input ? `Score: ${analysis.score}/100` : ""}
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${analysis.barColor}`}
                  animate={{ width: `${analysis.score}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <AnimatePresence>
              {input && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-3"
                >
                  {[
                    { label: "ENTROPY", value: `${analysis.entropy} bits` },
                    { label: "LENGTH", value: `${input.length} chars` },
                    { label: "CRACK TIME", value: analysis.timeToCrack },
                  ].map((s) => (
                    <div key={s.label} className="bg-secondary/50 rounded-lg p-3 text-center">
                      <div className="text-[9px] font-mono text-muted-foreground mb-1">{s.label}</div>
                      <div className="font-mono text-xs font-bold text-foreground">{s.value}</div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Checks */}
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3 h-3" /> REQUIREMENTS
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {analysis.checks.map((c) => (
                  <div key={c.label} className="flex items-center gap-2 text-xs">
                    {c.pass
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />}
                    <span className={c.pass ? "text-foreground" : "text-muted-foreground/50"}>{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Generator ── */}
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-border bg-secondary/30">
            <h2 className="font-mono font-bold text-sm text-foreground flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              SECURE GENERATOR
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cryptographically random via Web Crypto API</p>
          </div>

          <div className="p-5 flex flex-col gap-5">
            {/* Generated password */}
            <div className="relative">
              <div
                className="w-full bg-background border border-primary/30 rounded-lg px-4 py-3 pr-20 font-mono text-sm break-all text-primary min-h-[48px] shadow-[inset_0_0_20px_rgba(0,255,255,0.03)]"
              >
                {generated}
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  onClick={() => handleCopy(generated, "Password")}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleGenerate}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Mini strength for generated */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${genAnalysis.barColor}`}
                  animate={{ width: `${genAnalysis.score}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <span className={`text-[10px] font-mono font-bold ${genAnalysis.color} w-20 text-right`}>
                {genAnalysis.label.toUpperCase()}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {genAnalysis.entropy} bits
              </span>
            </div>

            {/* Length slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                <span>LENGTH</span>
                <span className="text-primary font-bold">{genOpts.length} characters</span>
              </div>
              <input
                type="range"
                min={8}
                max={64}
                value={genOpts.length}
                onChange={(e) => setGenOpts((o) => ({ ...o, length: Number(e.target.value) }))}
                className="w-full accent-cyan-400"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground/50">
                <span>8</span><span>64</span>
              </div>
            </div>

            {/* Checkboxes */}
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "upper" as const, label: "Uppercase A–Z" },
                  { key: "lower" as const, label: "Lowercase a–z" },
                  { key: "numbers" as const, label: "Numbers 0–9" },
                  { key: "symbols" as const, label: "Symbols !@#…" },
                  { key: "excludeAmbiguous" as const, label: "Exclude ambiguous (0O, 1Il)" },
                ] as { key: keyof GenOptions; label: string }[]
              ).map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-xs select-none col-span-1">
                  <div
                    onClick={() => toggle(key)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      genOpts[key] ? "bg-primary border-primary" : "bg-transparent border-border"
                    }`}
                  >
                    {genOpts[key] && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span className={genOpts[key] ? "text-foreground" : "text-muted-foreground/50"}>{label}</span>
                </label>
              ))}
            </div>

            <Button onClick={handleGenerate} className="w-full font-mono text-xs h-9">
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Generate New Password
            </Button>
          </div>
        </div>
      </div>

      {/* ── Multiple passwords ── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-secondary/30 flex items-center justify-between">
          <h2 className="font-mono font-bold text-sm text-foreground">BATCH GENERATE</h2>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 font-mono border-primary/30"
            onClick={() => {
              const passwords = Array.from({ length: 10 }, () => generatePassword(genOpts));
              navigator.clipboard.writeText(passwords.join("\n"));
              toast({ description: "10 passwords copied to clipboard" });
            }}
          >
            <Copy className="w-3 h-3 mr-1.5" /> Copy All
          </Button>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from({ length: 10 }, (_, i) => {
            const pwd = generatePassword(genOpts);
            const a = analyzePassword(pwd);
            return (
              <div
                key={i}
                className="flex items-center justify-between gap-3 bg-secondary/30 rounded-lg px-3 py-2 group"
              >
                <span className="font-mono text-xs text-primary truncate flex-1">{pwd}</span>
                <span className={`text-[9px] font-mono shrink-0 ${a.color}`}>{a.label}</span>
                <button
                  onClick={() => handleCopy(pwd, "Password")}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
