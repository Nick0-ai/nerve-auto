import { motion } from "framer-motion";
import { Code2, Copy, Rocket } from "lucide-react";
import { useState } from "react";

interface CodeCardProps {
  code: string;
  loading?: boolean;
  onDeploy?: () => void;
}

const CodeCard = ({ code, loading, onDeploy }: CodeCardProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden border-l-4 border-l-emerald-400"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-foreground">Training Script</span>
          <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded">
            train.py
          </span>
        </div>
        {!loading && (
          <button
            onClick={handleCopy}
            className="text-xs text-muted-foreground hover:text-foreground transition inline-flex items-center gap-1"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-auto bg-[#0a0a0a]">
        {loading ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-muted rounded" style={{ width: `${40 + Math.random() * 50}%` }} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center mt-4">Generating training script...</p>
          </div>
        ) : (
          <pre className="p-4 text-[12px] leading-5 font-mono text-emerald-400 whitespace-pre overflow-x-auto">
            {code}
          </pre>
        )}
      </div>

      {!loading && onDeploy && (
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={onDeploy}
            className="bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg inline-flex items-center gap-1.5 hover:brightness-110 transition"
          >
            <Rocket className="w-3.5 h-3.5" />
            Deploy this
          </button>
        </div>
      )}
    </motion.div>
  );
};

export default CodeCard;
