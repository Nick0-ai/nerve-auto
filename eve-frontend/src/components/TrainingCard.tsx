import { motion } from "framer-motion";
import { Activity } from "lucide-react";

interface TrainingEvent {
  type: string;
  message: string;
  color: string;
}

interface TrainingCardProps {
  progress: number;
  epoch: number;
  step: number;
  totalSteps: number;
  loss: number;
  lr: number;
  events: TrainingEvent[];
  status?: string;
}

const TrainingCard = ({
  progress,
  epoch,
  step,
  totalSteps,
  loss,
  lr,
  events,
  status,
}: TrainingCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-xl overflow-hidden border-l-4 border-l-amber-400"
  >
    <div className="px-4 py-3 flex items-center gap-2 border-b border-border">
      <Activity className="w-4 h-4 text-amber-400" />
      <span className="text-sm font-semibold text-foreground">Training</span>
      {status && (
        <span className="text-[10px] text-muted-foreground ml-auto">{status}</span>
      )}
    </div>

    <div className="p-4 space-y-4">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">Epoch</p>
          <p className="text-sm font-mono font-bold text-foreground">{epoch}/3</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Step</p>
          <p className="text-sm font-mono font-bold text-foreground">{step}/{totalSteps}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Loss</p>
          <p className="text-sm font-mono font-bold text-primary">{loss.toFixed(4)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">LR</p>
          <p className="text-sm font-mono font-bold text-foreground">{lr.toExponential(1)}</p>
        </div>
      </div>

      {/* Event log */}
      {events.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {events.map((evt, i) => (
            <div key={i} className={`text-[11px] font-mono ${evt.color}`}>
              {evt.message}
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

export default TrainingCard;
