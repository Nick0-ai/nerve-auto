import { motion } from "framer-motion";
import { CheckCircle2, Play, Leaf, DollarSign, Clock } from "lucide-react";
import { useState } from "react";
import { runPlayground } from "@/lib/api";

interface DeliveryCardProps {
  accuracy: number;
  costUsd: number;
  co2Grams: number;
  totalTime: string;
  modelId: string;
  task: string;
  examples: Array<{ input: string; output: string }>;
}

const DeliveryCard = ({
  accuracy,
  costUsd,
  co2Grams,
  totalTime,
  modelId,
  task,
  examples,
}: DeliveryCardProps) => {
  const [playgroundInput, setPlaygroundInput] = useState("");
  const [playgroundOutput, setPlaygroundOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (!playgroundInput.trim()) return;
    setLoading(true);
    setPlaygroundOutput("");
    try {
      const res = await runPlayground({
        input_text: playgroundInput,
        task,
        examples,
      });
      setPlaygroundOutput(res.output);
    } catch {
      setPlaygroundOutput("Error running prediction.");
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-primary/30 rounded-xl overflow-hidden border-l-4 border-l-primary"
    >
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border bg-primary/5">
        <CheckCircle2 className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Your AI is ready</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{accuracy}%</p>
            <p className="text-[10px] text-muted-foreground">Accuracy</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <DollarSign className="w-3 h-3 text-muted-foreground" />
              <p className="text-lg font-bold text-foreground">{costUsd}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Total cost</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Leaf className="w-3 h-3 text-emerald-400" />
              <p className="text-lg font-bold text-foreground">{co2Grams}g</p>
            </div>
            <p className="text-[10px] text-muted-foreground">CO₂</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-0.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <p className="text-lg font-bold text-foreground">{totalTime}</p>
            </div>
            <p className="text-[10px] text-muted-foreground">Time</p>
          </div>
        </div>

        {/* API endpoint */}
        <div className="bg-muted/50 rounded-lg px-3 py-2">
          <p className="text-[10px] text-muted-foreground mb-1">API Endpoint</p>
          <code className="text-xs font-mono text-primary">
            POST eve.ai/models/{modelId}/predict
          </code>
        </div>

        {/* Playground */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-foreground">Playground</p>
          </div>
          <div className="p-3 space-y-3">
            <textarea
              value={playgroundInput}
              onChange={(e) => setPlaygroundInput(e.target.value)}
              placeholder="Type something to test your model..."
              rows={2}
              className="w-full bg-muted text-foreground text-xs rounded-lg px-3 py-2 resize-none outline-none placeholder:text-muted-foreground font-sans"
            />
            <button
              onClick={handleTest}
              disabled={loading || !playgroundInput.trim()}
              className="bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hover:brightness-110 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {loading ? "Running..." : "Run"}
            </button>
            {playgroundOutput && (
              <div className="bg-muted/50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-1">Output</p>
                <p className="text-sm text-primary font-mono whitespace-pre-wrap">
                  {playgroundOutput}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default DeliveryCard;
