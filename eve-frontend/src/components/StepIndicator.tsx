const steps = [
  { key: "chat", label: "Chat" },
  { key: "dataset", label: "Data" },
  { key: "code", label: "Code" },
  { key: "scan", label: "GPU" },
  { key: "training", label: "Train" },
  { key: "done", label: "Test" },
];

interface StepIndicatorProps {
  currentStep: string;
}

const stepIndex = (step: string) => steps.findIndex((s) => s.key === step);

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  const current = stepIndex(currentStep);

  return (
    <div className="flex items-center justify-center gap-1 py-3 border-b border-border bg-background/80 backdrop-blur-xl">
      {steps.map((step, i) => {
        const isActive = i === current;
        const isDone = i < current;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full transition-all ${
                  isDone
                    ? "bg-primary"
                    : isActive
                    ? "bg-primary ring-4 ring-primary/20"
                    : "bg-muted"
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isDone || isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-8 h-px mx-1 mb-4 transition-colors ${
                  isDone ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
