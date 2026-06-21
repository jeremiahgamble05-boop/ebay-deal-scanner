import { useState } from "react";
import { Layout } from "@/components/layout";
import { DealCard } from "@/components/deal-card";
import { useListDeals, ListDealsSortBy } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function Deals() {
  const [minScore, setMinScore] = useState<string>("0");
  const [sortBy, setSortBy] = useState<ListDealsSortBy>("score");
  const [category, setCategory] = useState<string>("");

  const { data: deals, isLoading } = useListDeals({
    limit: 100,
    minScore: minScore ? parseFloat(minScore) : undefined,
    sortBy: sortBy,
    category: category || undefined
  });

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-card border border-border p-4 rounded-lg shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">DEAL_DATABASE</h1>
            <p className="text-sm text-muted-foreground mt-1">Search and filter historical and active deals.</p>
          </div>

          <div className="flex flex-wrap items-end gap-4 w-full md:w-auto">
            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground uppercase">Min Score</Label>
              <Input 
                type="number" 
                min="0" max="10" step="0.5"
                value={minScore} 
                onChange={(e) => setMinScore(e.target.value)} 
                className="w-24 font-mono bg-background"
              />
            </div>
            
            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground uppercase">Category</Label>
              <Input 
                type="text" 
                placeholder="Any"
                value={category} 
                onChange={(e) => setCategory(e.target.value)} 
                className="w-32 font-mono bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-mono text-muted-foreground uppercase">Sort By</Label>
              <Select value={sortBy} onValueChange={(v: ListDealsSortBy) => setSortBy(v)}>
                <SelectTrigger className="w-[140px] font-mono bg-background">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">AI Score</SelectItem>
                  <SelectItem value="discount">Discount %</SelectItem>
                  <SelectItem value="createdAt">Date Found</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground font-mono border border-dashed border-border rounded-lg">
              QUERYING_DATABASE...
            </div>
          ) : deals && deals.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {deals.map(deal => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground font-mono border border-dashed border-border rounded-lg">
              NO_MATCHES_FOUND
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
