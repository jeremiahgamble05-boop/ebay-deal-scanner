import { Link, useLocation } from "wouter";
import { Activity, LayoutDashboard, Search, List } from "lucide-react";
import { useGetScanStatus } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: scanStatus } = useGetScanStatus({
    query: {
      refetchInterval: 5000
    }
  });

  const isRunning = scanStatus?.status === "running";

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/deals", label: "Deal Feed", icon: List },
    { href: "/keywords", label: "Keywords", icon: Search },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded text-primary">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-widest uppercase">DEAL<span className="text-primary">SCANNER</span></h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${isRunning ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
              <span className="text-xs text-muted-foreground font-mono">
                {isRunning ? "SCANNING" : "IDLE"}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-colors text-sm font-medium ${
                  isActive 
                    ? "bg-accent text-accent-foreground" 
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex justify-between items-center text-xs font-mono text-muted-foreground">
            <span>CLIENTS</span>
            <span className="text-foreground">{scanStatus?.connectedClients || 0}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-mono text-muted-foreground mt-1">
            <span>ITEMS/m</span>
            <span className="text-foreground">{scanStatus?.itemsScanned || 0}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        {children}
      </main>
    </div>
  );
}
