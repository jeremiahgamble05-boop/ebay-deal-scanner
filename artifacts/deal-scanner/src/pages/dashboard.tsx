import { Layout } from "@/components/layout";
import { DealCard } from "@/components/deal-card";
import { useDealWebsocket } from "@/hooks/use-websocket";
import { useGetStats, useListDeals, useStartScan, useStopScan, useGetScanStatus, getListDealsQueryKey } from "@workspace/api-client-react";
import { Play, Square, Activity, TrendingDown, Target, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const queryClient = useQueryClient();
  const liveDeals = useDealWebsocket();
  
  const { data: stats } = useGetStats({
    query: { refetchInterval: 10000 }
  });
  
  const { data: scanStatus } = useGetScanStatus({
    query: { refetchInterval: 2000 }
  });
  
  const { data: initialDeals } = useListDeals(
    { limit: 20, sortBy: "createdAt" },
    { query: { refetchInterval: 30000 } }
  );

  const startScan = useStartScan();
  const stopScan = useStopScan();

  const isRunning = scanStatus?.status === "running";

  const handleToggleScan = () => {
    if (isRunning) {
      stopScan.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/v1/scan/status"] })
      });
    } else {
      startScan.mutate({ data: {} }, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/v1/scan/status"] })
      });
    }
  };

  // Merge live deals with initial deals, avoiding duplicates
  const allDeals = [...liveDeals];
  if (initialDeals) {
    initialDeals.forEach(deal => {
      if (!allDeals.find(d => d.id === deal.id)) {
        allDeals.push(deal);
      }
    });
  }

  // Sort by createdAt desc
  allDeals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        {/* Header / Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card border border-border p-4 rounded-lg shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">TERMINAL / DASHBOARD</h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time deal analysis and market scanning engine.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4">
              <span className="text-xs text-muted-foreground uppercase font-mono">System Status</span>
              <span className={`text-sm font-mono font-bold ${isRunning ? "text-primary" : "text-muted-foreground"}`}>
                {isRunning ? "ACTIVE_SCAN" : "STANDBY"}
              </span>
            </div>
            <Button 
              onClick={handleToggleScan}
              variant={isRunning ? "destructive" : "default"}
              className="font-mono uppercase font-bold tracking-wider"
              disabled={startScan.isPending || stopScan.isPending}
            >
              {isRunning ? <><Square className="mr-2" size={16} /> Halt Scan</> : <><Play className="mr-2" size={16} /> Initialize</>}
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Active Deals" value={stats?.activeDeals || 0} icon={Target} />
          <StatCard title="Avg Discount" value={`${stats?.avgDiscount?.toFixed(1) || 0}%`} icon={TrendingDown} />
          <StatCard title="Total Savings" value={`$${stats?.totalSavings?.toLocaleString() || 0}`} icon={Zap} />
          <StatCard title="Avg AI Score" value={stats?.avgAiScore?.toFixed(2) || "0.0"} icon={Activity} />
        </div>

        {/* Live Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-lg font-mono font-bold text-foreground flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
              LIVE_FEED
            </h2>
            <span className="text-xs font-mono text-muted-foreground">{allDeals.length} deals in buffer</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {allDeals.slice(0, 50).map(deal => (
              <DealCard key={deal.id} deal={deal} />
            ))}
            {allDeals.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground font-mono border border-dashed border-border rounded-lg">
                NO_DATA_AVAILABLE... AWAITING_SCAN
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string, value: string | number, icon: any }) {
  return (
    <div className="bg-card border border-border p-4 rounded-lg flex flex-col gap-2 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 opacity-5 text-foreground">
        <Icon size={64} />
      </div>
      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{title}</span>
      <span className="text-3xl font-bold font-mono text-foreground">{value}</span>
    </div>
  );
}
