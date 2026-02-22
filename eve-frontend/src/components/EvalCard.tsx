import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

interface EvalResult {
  version: number;
  accuracy: number;
  f1: number;
  loss: number;
  note: string;
}

interface EvalCardProps {
  results: EvalResult[];
}

const EvalCard = ({ results }: EvalCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-xl overflow-hidden border-l-4 border-l-violet-400"
  >
    <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
      <BarChart3 className="w-4 h-4 text-violet-400" />
      <span className="text-sm font-semibold text-foreground">Auto-Evaluation</span>
    </div>

    <div className="p-4 space-y-3">
      {results.map((r) => (
        <div key={r.version} className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-foreground">v{r.version}</span>
            <span
              className={`text-xs font-bold ${
                r.accuracy >= 90 ? "text-primary" : "text-amber-400"
              }`}
            >
              {r.accuracy}% accuracy
            </span>
          </div>

          {/* Accuracy bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
            <motion.div
              className={`h-full rounded-full ${
                r.accuracy >= 90 ? "bg-primary" : "bg-amber-400"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${r.accuracy}%` }}
              transition={{ duration: 0.5, delay: r.version * 0.3 }}
            />
          </div>

          <div className="flex gap-4 text-[10px] text-muted-foreground mb-1">
            <span>F1: {r.f1.toFixed(2)}</span>
            <span>Loss: {r.loss.toFixed(4)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground italic">{r.note}</p>
        </div>
      ))}

      {results.length >= 2 && (
        <p className="text-[11px] text-primary text-center font-medium">
          Eve found weaknesses in v1 and retrained automatically.
        </p>
      )}
    </div>
  </motion.div>
);

export default EvalCard;
