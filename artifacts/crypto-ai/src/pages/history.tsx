import { useGetEncryptionHistory, useGetEncryptionStats } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, Clock, ShieldCheck, Database, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function HistoryPage() {
  const { data: history, isLoading: hLoading } = useGetEncryptionHistory();
  const { data: stats, isLoading: sLoading } = useGetEncryptionStats();

  if (hLoading || sLoading) return <div className="p-8 space-y-4"><Skeleton className="h-32 bg-card w-full" /><Skeleton className="h-64 bg-card w-full" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-mono text-primary flex items-center gap-3">
          <Database className="w-8 h-8" />
          SYSTEM_LOG
        </h1>
        <p className="text-muted-foreground mt-2">Historical cryptographic operations and performance metrics.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-mono">TOTAL OPS</div>
            <div className="text-2xl font-bold font-mono">{stats?.totalOperations || 0}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-mono">ENCRYPTIONS</div>
            <div className="text-2xl font-bold font-mono">{stats?.encryptCount || 0}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-chart-4/10 flex items-center justify-center text-chart-4">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-mono">TOP ALGO</div>
            <div className="text-xl font-bold font-mono mt-1">{stats?.mostUsedAlgorithm || 'N/A'}</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-mono">AVG TIME</div>
            <div className="text-xl font-bold font-mono mt-1">{stats?.averageProcessingTime ? `${stats.averageProcessingTime.toFixed(2)}ms` : '0ms'}</div>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-secondary/50 font-mono font-bold text-sm">
          OPERATION TIMELINE
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead className="bg-secondary/20 text-muted-foreground text-xs text-left">
              <tr>
                <th className="px-4 py-3 font-normal">TIMESTAMP</th>
                <th className="px-4 py-3 font-normal">OPERATION</th>
                <th className="px-4 py-3 font-normal">ALGORITHM</th>
                <th className="px-4 py-3 font-normal">I/O LENGTH</th>
                <th className="px-4 py-3 font-normal">PROC TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history?.map(entry => (
                <tr key={entry.id} className="hover:bg-secondary/20 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground">{format(new Date(entry.createdAt), "MMM dd, HH:mm:ss")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs ${entry.operation === 'encrypt' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                      {entry.operation.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold">{entry.algorithm}</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.inputLength} → {entry.outputLength} chars</td>
                  <td className="px-4 py-3 text-muted-foreground">{entry.processingTime.toFixed(1)}ms</td>
                </tr>
              ))}
              {(!history || history.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No operations recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
