import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat, generateDataset, generateCode, scanGPU, streamDeploy } from "@/lib/api";
import StepIndicator from "@/components/StepIndicator";
import InputBar from "@/components/InputBar";
import MessageBubble from "@/components/MessageBubble";
import DatasetCard from "@/components/DatasetCard";
import CodeCard from "@/components/CodeCard";
import ScanCard from "@/components/ScanCard";
import TrainingCard from "@/components/TrainingCard";
import EvalCard from "@/components/EvalCard";
import DeliveryCard from "@/components/DeliveryCard";

// ---- Types ----

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  action?: string;
}

type Step = "chat" | "dataset" | "code" | "scan" | "training" | "done";

interface TrainingEvent {
  type: string;
  message: string;
  color: string;
}

interface EvalResult {
  version: number;
  accuracy: number;
  f1: number;
  loss: number;
  note: string;
}

// ---- Component ----

const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<Step>("chat");
  const [isStreaming, setIsStreaming] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");

  // Action state
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [dataset, setDataset] = useState<Array<{ input: string; output: string }>>([]);
  const [codeLoading, setCodeLoading] = useState(false);
  const [code, setCode] = useState("");
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const [trainingActive, setTrainingActive] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingEpoch, setTrainingEpoch] = useState(0);
  const [trainingStep, setTrainingStep] = useState(0);
  const [trainingTotalSteps, setTrainingTotalSteps] = useState(300);
  const [trainingLoss, setTrainingLoss] = useState(0);
  const [trainingLR, setTrainingLR] = useState(0);
  const [trainingEvents, setTrainingEvents] = useState<TrainingEvent[]>([]);
  const [trainingStatus, setTrainingStatus] = useState("");
  const [evalResults, setEvalResults] = useState<EvalResult[]>([]);
  const [deliveryData, setDeliveryData] = useState<Record<string, unknown> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const idCounter = useRef(0);

  const newId = () => `msg-${++idCounter.current}`;

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, dataset, code, scanResult, trainingProgress, evalResults, deliveryData]);

  // ---- Handle actions from Eve's stream ----

  const handleAction = useCallback(
    async (actionType: string) => {
      if (actionType === "GENERATE_DATASET") {
        setStep("dataset");
        setDatasetLoading(true);
        try {
          const res = await generateDataset({
            task: taskDescription,
            description: taskDescription,
            num_examples: 20,
          });
          setDataset(res.examples || []);
        } catch {
          setDataset([]);
        }
        setDatasetLoading(false);
      } else if (actionType === "GENERATE_CODE") {
        setStep("code");
        setCodeLoading(true);
        try {
          const res = await generateCode({
            task: taskDescription,
            base_model: "Llama 3.1 8B",
            dataset_sample: dataset.slice(0, 3),
          });
          setCode(res.code || "# Error generating code");
        } catch {
          setCode("# Error generating code");
        }
        setCodeLoading(false);
      } else if (actionType === "SCAN_GPU") {
        setStep("scan");
        setScanLoading(true);
        try {
          const res = await scanGPU();
          setScanResult(res.best || res);
        } catch {
          setScanResult(null);
        }
        setScanLoading(false);
      } else if (actionType === "START_TRAINING") {
        setStep("training");
        startTraining();
      }
    },
    [taskDescription, dataset]
  );

  // ---- Send message ----

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      // Save first user message as task description
      if (messages.length === 0) {
        setTaskDescription(content);
      }

      const userMsg: Message = { id: newId(), role: "user", content };
      const assistantMsg: Message = {
        id: newId(),
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      await streamChat(apiMessages, {
        onToken: (text) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + text }
                : m
            )
          );
        },
        onAction: (type) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, action: type } : m
            )
          );
          handleAction(type);
        },
        onDone: () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, isStreaming: false } : m
            )
          );
          setIsStreaming(false);
        },
        onError: (msg) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content || `Error: ${msg}`, isStreaming: false }
                : m
            )
          );
          setIsStreaming(false);
        },
      });
    },
    [messages, isStreaming, handleAction]
  );

  // ---- Dataset approved → send message to advance ----

  const handleDatasetApproved = () => {
    sendMessage("Dataset approved. Generate the training code.");
  };

  const handleDatasetRegenerate = async () => {
    setDatasetLoading(true);
    try {
      const res = await generateDataset({
        task: taskDescription,
        description: taskDescription,
        num_examples: 20,
      });
      setDataset(res.examples || []);
    } catch {
      // keep existing
    }
    setDatasetLoading(false);
  };

  // ---- Code approved → advance ----

  const handleCodeDeploy = () => {
    sendMessage("Code looks good. Find the best GPU.");
  };

  // ---- Scan done → deploy ----

  const handleScanDeploy = () => {
    sendMessage("Deploy to this GPU. Start training.");
  };

  // ---- Training simulation ----

  const startTraining = async () => {
    setTrainingActive(true);
    setTrainingEvents([]);
    setEvalResults([]);
    setDeliveryData(null);

    await streamDeploy({
      onStatus: (data) => {
        setTrainingStatus(data.message);
        setTrainingProgress(data.progress);
      },
      onLog: (data) => {
        setTrainingEpoch(data.epoch);
        setTrainingStep(data.step);
        setTrainingTotalSteps(data.total_steps);
        setTrainingLoss(data.loss);
        setTrainingLR(data.lr);
        setTrainingProgress(data.progress);
      },
      onCheckpoint: (data) => {
        setTrainingEvents((prev) => [
          ...prev,
          {
            type: "checkpoint",
            message: `\u2713 Checkpoint saved at step ${data.step} (${data.size_gb} GB)`,
            color: "text-primary",
          },
        ]);
      },
      onEviction: (data) => {
        setTrainingEvents((prev) => [
          ...prev,
          {
            type: "eviction",
            message: `\u26a0 EVICTION \u2014 Migrating from ${data.from_az} to ${data.to_az}...`,
            color: "text-amber-400",
          },
        ]);
      },
      onMigrated: (data) => {
        setTrainingEvents((prev) => [
          ...prev,
          {
            type: "migrated",
            message: `\u2713 Restored in ${data.recovery_sec}s. Zero data loss.`,
            color: "text-primary",
          },
        ]);
      },
      onEval: (data) => {
        setEvalResults((prev) => [...prev, data]);
        setTrainingProgress(data.version === 1 ? 85 : 95);
      },
      onComplete: (data) => {
        setTrainingActive(false);
        setTrainingProgress(100);
        setTrainingStatus("Complete");
        setStep("done");
        setDeliveryData(data);
        setTrainingEvents((prev) => [
          ...prev,
          {
            type: "complete",
            message: `\u2713 Training complete \u2014 ${data.accuracy}% accuracy`,
            color: "text-primary",
          },
        ]);
      },
    });
  };

  // ---- Render ----

  return (
    <div className="h-screen flex flex-col">
      <StepIndicator currentStep={step} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {/* Welcome message if empty */}
          {messages.length === 0 && (
            <div className="text-center py-20">
              <p className="text-3xl font-bold text-foreground mb-2">
                What do you want to build?
              </p>
              <p className="text-sm text-muted-foreground">
                Describe your AI model in plain language. Eve handles the rest.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble
                role={msg.role}
                content={msg.content}
                isStreaming={msg.isStreaming && !msg.content}
              >
                {/* Render action cards inline after the message */}
                {msg.action === "GENERATE_DATASET" && (
                  <DatasetCard
                    examples={dataset}
                    loading={datasetLoading}
                    onApprove={!datasetLoading && dataset.length > 0 ? handleDatasetApproved : undefined}
                    onRegenerate={!datasetLoading ? handleDatasetRegenerate : undefined}
                  />
                )}
                {msg.action === "GENERATE_CODE" && (
                  <CodeCard
                    code={code}
                    loading={codeLoading}
                    onDeploy={!codeLoading && code ? handleCodeDeploy : undefined}
                  />
                )}
                {msg.action === "SCAN_GPU" && (
                  <ScanCard
                    result={scanResult as any}
                    loading={scanLoading}
                    onDeploy={!scanLoading && scanResult ? handleScanDeploy : undefined}
                  />
                )}
                {msg.action === "START_TRAINING" && (
                  <div className="space-y-3">
                    <TrainingCard
                      progress={trainingProgress}
                      epoch={trainingEpoch}
                      step={trainingStep}
                      totalSteps={trainingTotalSteps}
                      loss={trainingLoss}
                      lr={trainingLR}
                      events={trainingEvents}
                      status={trainingStatus}
                    />
                    {evalResults.length > 0 && <EvalCard results={evalResults} />}
                    {deliveryData && (
                      <DeliveryCard
                        accuracy={(deliveryData.accuracy as number) || 94.2}
                        costUsd={(deliveryData.cost_usd as number) || 2.96}
                        co2Grams={(deliveryData.co2_grams as number) || 54}
                        totalTime={(deliveryData.total_time as string) || "42m"}
                        modelId={(deliveryData.model_id as string) || "eve-0001"}
                        task={taskDescription}
                        examples={dataset}
                      />
                    )}
                  </div>
                )}
              </MessageBubble>
            </div>
          ))}
        </div>
      </div>

      <InputBar
        onSend={sendMessage}
        disabled={isStreaming || trainingActive}
        placeholder={
          step === "chat"
            ? "Describe the AI you want to build..."
            : "Type a message..."
        }
      />
    </div>
  );
};

export default Chat;
