import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListKeywords, useAddKeyword, useDeleteKeyword, getListKeywordsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function Keywords() {
  const queryClient = useQueryClient();
  const { data: keywords, isLoading } = useListKeywords();
  const addKeyword = useAddKeyword();
  const deleteKeyword = useDeleteKeyword();

  const [keyword, setKeyword] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minDiscount, setMinDiscount] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;

    addKeyword.mutate({
      data: {
        keyword: keyword.trim(),
        maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
        minDiscount: minDiscount ? parseFloat(minDiscount) : undefined
      }
    }, {
      onSuccess: () => {
        setKeyword("");
        setMaxPrice("");
        setMinDiscount("");
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteKeyword.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
      }
    });
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        
        <div>
          <h1 className="text-2xl font-bold text-foreground font-mono tracking-tight">SCAN_TARGETS</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure search parameters and threshold triggers.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Add Form */}
          <div className="col-span-1">
            <form onSubmit={handleAdd} className="bg-card border border-border p-4 rounded-lg space-y-4 shadow-sm">
              <h2 className="font-mono font-bold text-sm border-b border-border pb-2 uppercase">New Target</h2>
              
              <div className="space-y-1">
                <Label className="text-xs font-mono text-muted-foreground uppercase">Search Term *</Label>
                <Input 
                  value={keyword} 
                  onChange={(e) => setKeyword(e.target.value)} 
                  placeholder="e.g. macbook pro m2"
                  className="bg-background font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-mono text-muted-foreground uppercase">Max Price ($)</Label>
                <Input 
                  type="number" min="0" step="0.01"
                  value={maxPrice} 
                  onChange={(e) => setMaxPrice(e.target.value)} 
                  placeholder="Optional"
                  className="bg-background font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-mono text-muted-foreground uppercase">Min Discount (%)</Label>
                <Input 
                  type="number" min="0" max="100" step="1"
                  value={minDiscount} 
                  onChange={(e) => setMinDiscount(e.target.value)} 
                  placeholder="Optional"
                  className="bg-background font-mono"
                />
              </div>

              <Button type="submit" className="w-full font-mono uppercase font-bold" disabled={addKeyword.isPending || !keyword.trim()}>
                <Plus size={16} className="mr-2" /> Add Target
              </Button>
            </form>
          </div>

          {/* List */}
          <div className="col-span-1 md:col-span-2">
            <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/20">
                <h2 className="font-mono font-bold text-sm uppercase">Active Targets ({keywords?.length || 0})</h2>
              </div>
              
              <div className="divide-y divide-border">
                {isLoading ? (
                  <div className="p-8 text-center text-muted-foreground font-mono text-sm">LOADING_TARGETS...</div>
                ) : keywords?.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground font-mono text-sm">NO_TARGETS_CONFIGURED</div>
                ) : (
                  keywords?.map(kw => (
                    <div key={kw.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                      <div>
                        <div className="font-bold text-foreground text-lg tracking-tight">{kw.keyword}</div>
                        <div className="flex gap-4 mt-1 text-xs font-mono text-muted-foreground">
                          {kw.maxPrice ? <span>Max: ${kw.maxPrice.toFixed(2)}</span> : <span>Max: ANY</span>}
                          {kw.minDiscount ? <span>Min Disc: {kw.minDiscount}%</span> : <span>Min Disc: ANY</span>}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(kw.id)}
                        disabled={deleteKeyword.isPending}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
