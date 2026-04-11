import { useGetEncryptionHistory, useGetEncryptionStats } from "@workspace/api-client-react";
import { format, formatDistanceToNow } from "date-fns";
import { Activity, Clock, ShieldCheck, Database, TrendingUp, Lock, Unlock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const ALGO_COLORS: Record<string, string> = {
  AES: "#00e5ff",
  Base64: "#6b7280",
  Caesar: "#fbbf24",
  ROT13: "#a78bfa",
  Vigenere: "#f59e0b",
  XOR: "#34d399",
};

export function HistoryPage() {
  const { data: history, isLoading: hLoading, refetch: refetchHistory } = useGetEncryptionHistory();
  const { data: stats, isLoading: sLoading, refetch: refetchStats } = useGetEncryptionStats();

  const handleRefresh = () => {
    refetchHistory();
    refetchStats();
  };

  // Build algo breakdown for chart
  const algoBreakdown = (() => {
    if (!history) return [];
    const counts: Record<string, { encrypt: number; decrypt: number }> = {};
    for (const entry of history) {
      if (!counts[entry.algorithm]) counts[entry.algorithm] = { encrypt: 0, decrypt: 0 };
      counts[entry.algorithm][entry.operation as "encrypt" | "decrypt"]++;
    }
    return Object.entries(counts).map(([algo, c]) => ({
      algo,
      Encrypt: c.encrypt,
      Decrypt: c.decrypt,
      total: c.encrypt + c.decrypt,
    })).sort((a, b) => b.total - a.total);
  })();

  if (hLoading || sLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const hasData = (stats?.totalOperations ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-3">
            <Database className="w-6 h-6" />
            SYSTEM LOG
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All encryption and decryption operations · Last {history?.length ?? 0} entries
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} className="font-mono text-xs gap-2 border-border">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground font-mono">TOTAL OPS</div>
            <div className="text-2xl font-bold font-mono">{stats?.totalOperations ?? 0}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-900/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground font-mono">ENCRYPTED</div>
            <div className="text-2xl font-bold font-mono">{stats?.encryptCount ?? 0}</div>
            {hasData && (
              <div className="text-[10px] text-muted-foreground font-mono">
                {((stats!.encryptCount / stats!.totalOperations) * 100).toFixed(0)}% of total
              </div>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-900/30 flex items-center justify-center text-amber-400 shrink-0">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground font-mono">DECRYPTED</div>
            <div className="text-2xl font-bold font-mono">{stats?.decryptCount ?? 0}</div>
            {hasData && (
              <div className="text-[10px] text-muted-foreground font-mono">
                {((stats!.decryptCount / stats!.totalOperations) * 100).toFixed(0)}% of total
              </div>
            )}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-[10px] text-muted-foreground font-mono">TOP ALGO / AVG TIME</div>
          <div className="font-bold font-mono text-primary text-base">
            {stats?.mostUsedAlgorithm || "—"}
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span className="text-xs font-mono">
              {stats?.averageProcessingTime ? `${stats.averageProcessingTime.toFixed(2)}ms avg` : "0ms"}
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {hasData && algoBreakdown.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="font-mono text-sm font-bold">ALGORITHM USAGE BREAKDOWN</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={algoBreakdown} barGap={2} barCategoryGap="30%">
              <XAxis
                dataKey="algo"
                tick={{ fill: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(222 47% 11%)",
                  border: "1px solid hsl(217 32% 17%)",
                  borderRadius: 8,
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "#f1f5f9",
                }}
                cursor={{ fill: "rgba(0,229,255,0.04)" }}
              />
              <Bar dataKey="Encrypt" radius={[4, 4, 0, 0]}>
                {algoBreakdown.map((entry) => (
                  <Cell key={entry.algo} fill={ALGO_COLORS[entry.algo] ?? "#00e5ff"} fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar dataKey="Decrypt" radius={[4, 4, 0, 0]}>
                {algoBreakdown.map((entry) => (
                  <Cell key={entry.algo} fill={ALGO_COLORS[entry.algo] ?? "#00e5ff"} fillOpacity={0.35} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <div className="w-3 h-2 rounded-sm bg-cyan-400/80" /> Encrypt
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <div className="w-3 h-2 rounded-sm bg-cyan-400/35" /> Decrypt
            </div>
          </div>
        </div>
      )}

      {/* Timeline Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-secondary/30 font-mono font-bold text-xs text-muted-foreground">
          OPERATION TIMELINE
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead className="bg-secondary/20 text-muted-foreground text-[10px] text-left">
              <tr>
                <th className="px-5 py-3 font-normal">TIMESTAMP</th>
                <th className="px-5 py-3 font-normal">OPERATION</th>
                <th className="px-5 py-3 font-normal">ALGORITHM</th>
                <th className="px-5 py-3 font-normal">INPUT → OUTPUT</th>
                <th className="px-5 py-3 font-normal">SIZE RATIO</th>
                <th className="px-5 py-3 font-normal">TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {history?.map((entry) => (
                <tr key={entry.id} className="hover:bg-secondary/15 transition-colors">
                  <td className="px-5 py-3">
                    <div className="text-muted-foreground text-[11px]">
                      {format(new Date(entry.createdAt), "MMM dd, HH:mm:ss")}
                    </div>
                    <div className="text-muted-foreground/40 text-[10px]">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                        entry.operation === "encrypt"
                          ? "bg-primary/10 text-primary border-primary/25"
                          : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                      }`}
                    >
                      {entry.operation === "encrypt" ? "ENCRYPT" : "DECRYPT"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        color: ALGO_COLORS[entry.algorithm] ?? "#00e5ff",
                        background: `${ALGO_COLORS[entry.algorithm] ?? "#00e5ff"}15`,
                      }}
                    >
                      {entry.algorithm}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-[11px]">
                    {entry.inputLength} → {entry.outputLength} chars
                  </td>
                  <td className="px-5 py-3 text-[11px]">
                    <span className={
                      entry.outputLength > entry.inputLength * 1.5
                        ? "text-amber-400"
                        : entry.outputLength <= entry.inputLength
                        ? "text-emerald-400"
                        : "text-muted-foreground"
                    }>
                      {(entry.outputLength / Math.max(entry.inputLength, 1)).toFixed(2)}x
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground text-[11px]">
                    {entry.processingTime.toFixed(1)}ms
                  </td>
                </tr>
              ))}
              {(!history || history.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-muted-foreground/30" />
                      <span>No operations recorded yet. Head to the Workspace to encrypt something.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
