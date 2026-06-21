import { Deal, useDismissDeal } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, X, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DealCardProps {
  deal: Deal;
}

export function DealCard({ deal }: DealCardProps) {
  const dismissDeal = useDismissDeal();

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500/20 text-green-500 border-green-500/30";
    if (score >= 5) return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    return "bg-red-500/20 text-red-500 border-red-500/30";
  };

  const handleDismiss = () => {
    dismissDeal.mutate({ id: deal.id });
  };

  if (deal.status === "dismissed") return null;

  return (
    <div className="flex flex-col bg-card border border-border rounded-md overflow-hidden hover:border-primary/50 transition-colors group">
      <div className="flex p-4 gap-4">
        {/* Image */}
        <div className="w-24 h-24 bg-muted rounded shrink-0 overflow-hidden flex items-center justify-center border border-border/50">
          {deal.imageUrl ? (
            <img src={deal.imageUrl} alt={deal.title} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-muted-foreground">No image</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-4">
            <h3 className="font-medium text-sm text-foreground line-clamp-2 leading-tight">
              {deal.title}
            </h3>
            <div className="flex gap-2 shrink-0">
              {deal.aiScore !== undefined && deal.aiScore !== null && (
                <div className={`px-2 py-0.5 rounded text-xs font-mono border flex items-center gap-1 ${getScoreColor(deal.aiScore)}`}>
                  <Star size={12} />
                  {deal.aiScore.toFixed(1)}
                </div>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-2 items-center">
            <div className="text-lg font-mono font-bold text-foreground">
              ${deal.currentPrice.toFixed(2)}
            </div>
            {deal.originalPrice && (
              <div className="text-xs font-mono text-muted-foreground line-through">
                ${deal.originalPrice.toFixed(2)}
              </div>
            )}
            {deal.discountPercent && deal.discountPercent > 0 && (
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-mono rounded-sm py-0">
                -{deal.discountPercent}%
              </Badge>
            )}
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="truncate">{deal.seller} {deal.sellerRating ? `(${deal.sellerRating}%)` : ""}</span>
            <span className="px-1.5 py-0.5 bg-muted rounded uppercase text-[10px]">{deal.condition}</span>
            <span className="px-1.5 py-0.5 bg-muted rounded uppercase text-[10px]">{deal.keyword}</span>
          </div>
        </div>
      </div>

      {/* Analysis & Actions */}
      <div className="px-4 py-2 border-t border-border bg-muted/30 flex justify-between items-center text-xs">
        <div className="text-muted-foreground line-clamp-1 italic pr-4">
          {deal.aiAnalysis || "No analysis provided."}
        </div>
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={handleDismiss}>
            <X size={14} />
          </Button>
          <a href={deal.itemUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1 rounded-sm font-medium transition-colors">
            View <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
}
