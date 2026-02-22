import { motion } from "framer-motion";
import { Database, Check, RefreshCw } from "lucide-react";

interface DatasetCardProps {
  examples: Array<{ input: string; output: string }>;
  loading?: boolean;
  onApprove?: () => void;
  onRegenerate?: () => void;
}

const DatasetCard = ({ examples, loading, onApprove, onRegenerate }: DatasetCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-xl overflow-hidden border-l-4 border-l-primary"
  >
    <div className="px-4 py-3 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Training Dataset</span>
        {!loading && (
          <span className="text-[10px] font-mono bg-primary/20 text-primary px-2 py-0.5 rounded-full">
            {examples.length} examples
          </span>
        )}
      </div>
    </div>

    <div className="max-h-60 overflow-y-auto">
      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
          <p className="text-xs text-muted-foreground text-center mt-4">Generating examples...</p>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left px-4 py-2 font-medium">Input</th>
              <th className="text-left px-4 py-2 font-medium">Output</th>
            </tr>
          </thead>
          <tbody>
            {examples.slice(0, 8).map((ex, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
                <td className="px-4 py-2.5 text-foreground max-w-[300px] truncate">{ex.input}</td>
                <td className="px-4 py-2.5 text-primary font-mono max-w-[200px] truncate">{ex.output}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>

    {!loading && onApprove && (
      <div className="px-4 py-3 border-t border-border flex gap-2">
        <button
          onClick={onApprove}
          className="bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hover:brightness-110 transition"
        >
          <Check className="w-3.5 h-3.5" />
          Approve
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            className="border border-border text-foreground text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hover:bg-muted transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Regenerate
          </button>
        )}
      </div>
    )}
  </motion.div>
);

export default DatasetCard;
