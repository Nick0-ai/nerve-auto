const BASE = import.meta.env.VITE_API_URL || "http://localhost:8001";

// ---- SSE streaming for /api/chat ----

export interface SSECallbacks {
  onToken: (text: string) => void;
  onAction: (type: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}

export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  callbacks: SSECallbacks
) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok || !res.body) {
    callbacks.onError("Failed to connect to Eve");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          if (currentEvent === "token" && data.content) {
            callbacks.onToken(data.content);
          } else if (currentEvent === "action" && data.type) {
            callbacks.onAction(data.type);
          } else if (currentEvent === "done") {
            callbacks.onDone();
          } else if (currentEvent === "error") {
            callbacks.onError(data.message || "Unknown error");
          }
        } catch {
          // ignore malformed JSON
        }
      }
    }
  }
  callbacks.onDone();
}

// ---- SSE streaming for /api/deploy ----

export interface DeployCallbacks {
  onStatus: (data: { message: string; progress: number }) => void;
  onLog: (data: {
    epoch: number;
    step: number;
    total_steps: number;
    loss: number;
    lr: number;
    progress: number;
  }) => void;
  onCheckpoint: (data: { step: number; size_gb: number }) => void;
  onEviction: (data: { from_az: string; to_az: string }) => void;
  onMigrated: (data: { recovery_sec: number; data_loss: number }) => void;
  onEval: (data: {
    version: number;
    accuracy: number;
    f1: number;
    loss: number;
    note: string;
  }) => void;
  onComplete: (data: Record<string, unknown>) => void;
}

export async function streamDeploy(callbacks: DeployCallbacks) {
  const res = await fetch(`${BASE}/api/deploy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!res.ok || !res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          switch (currentEvent) {
            case "status": callbacks.onStatus(data); break;
            case "log": callbacks.onLog(data); break;
            case "checkpoint": callbacks.onCheckpoint(data); break;
            case "eviction": callbacks.onEviction(data); break;
            case "migrated": callbacks.onMigrated(data); break;
            case "eval": callbacks.onEval(data); break;
            case "complete": callbacks.onComplete(data); break;
          }
        } catch {
          // ignore
        }
      }
    }
  }
}

// ---- Simple JSON endpoints ----

export async function generateDataset(params: {
  task: string;
  description: string;
  num_examples?: number;
  base_model?: string;
}) {
  const res = await fetch(`${BASE}/api/generate-dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function generateCode(params: {
  task: string;
  base_model?: string;
  dataset_sample?: Array<{ input: string; output: string }>;
}) {
  const res = await fetch(`${BASE}/api/generate-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function scanGPU() {
  const res = await fetch(`${BASE}/api/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function runPlayground(params: {
  input_text: string;
  task: string;
  examples: Array<{ input: string; output: string }>;
}) {
  const res = await fetch(`${BASE}/api/playground`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}
