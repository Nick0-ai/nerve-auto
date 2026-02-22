"""
Eve — AI that creates AI models.
Single-file FastAPI backend with 6 endpoints.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import anthropic
import asyncio
import json
import math
import random
import os
import re
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Eve API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
MODEL = os.getenv("EVE_MODEL", "claude-sonnet-4-20250514")
FAST_MODEL = os.getenv("EVE_FAST_MODEL", "claude-sonnet-4-20250514")

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

EVE_SYSTEM_PROMPT = """You are Eve, an AI that creates custom AI models from scratch through conversation.

You guide users through building their own fine-tuned model in a natural conversation. You are concise, technical but friendly, and you move fast.

## Your pipeline (follow this order):

STEP 1 — UNDERSTAND
Ask 1-2 clarifying questions MAX to understand:
- What task? (classification, generation, chatbot, summarization, etc.)
- Does the user have training data? (usually no — you'll generate it)
- Any specific requirements?
Then suggest a base model (Llama 3.1 8B for classification/small tasks, Mistral 7B for generation, Llama 70B for complex reasoning).
If a simple prompt would suffice (no fine-tuning needed), say so honestly.

STEP 2 — DATASET
When you have enough info, say something like "I'll generate your training dataset now." then output EXACTLY this marker on its own line:
<<<ACTION:GENERATE_DATASET>>>
Do NOT generate the dataset yourself. The system will handle it.
After the dataset is shown to the user, ask them to approve or adjust.

STEP 3 — CODE
After dataset approval, say "Generating the training script..." then output:
<<<ACTION:GENERATE_CODE>>>
Do NOT write the code yourself. The system handles it.

STEP 4 — GPU
After code is shown, say "Scanning for the best GPU..." then output:
<<<ACTION:SCAN_GPU>>>

STEP 5 — TRAIN
After GPU results, say "Deploying to the GPU. Training starts now." then output:
<<<ACTION:START_TRAINING>>>

STEP 6 — DELIVER
After training completes, summarize the results and invite the user to test in the playground.

## Rules:
- Be concise: 2-3 sentences per message MAX (before action markers).
- Sound confident. You've done this thousands of times.
- Suggest smart defaults. Don't ask unnecessary questions.
- Use technical terms casually (LoRA, QLoRA, learning rate, epochs) but don't overwhelm.
- Never apologize. Never say "I'm just an AI."
- Move through steps quickly. After step 1, go straight to step 2.
- Each message should have AT MOST one action marker.
- Respond in the same language as the user (French if they write French, English if English).
"""

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    messages: list[dict]

class DatasetRequest(BaseModel):
    task: str = ""
    description: str = ""
    num_examples: int = 20
    base_model: str = "Llama 3.1 8B"

class CodeRequest(BaseModel):
    task: str = ""
    base_model: str = "Llama 3.1 8B"
    dataset_sample: list[dict] = []

class PlaygroundRequest(BaseModel):
    input_text: str
    task: str = ""
    examples: list[dict] = []

class ScanRequest(BaseModel):
    min_gpu_memory_gb: int = 24
    estimated_gpu_hours: float = 4.0

class DeployRequest(BaseModel):
    model_name: str = "Llama 3.1 8B"
    gpu: str = "A100"
    total_steps: int = 300

# ---------------------------------------------------------------------------
# SSE helper
# ---------------------------------------------------------------------------

def sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"

# ---------------------------------------------------------------------------
# 1. POST /api/chat — SSE streaming conversation
# ---------------------------------------------------------------------------

@app.post("/api/chat")
async def chat(req: ChatRequest):
    async def generate():
        try:
            with client.messages.stream(
                model=MODEL,
                max_tokens=2048,
                system=EVE_SYSTEM_PROMPT,
                messages=req.messages,
            ) as stream:
                buffer = ""
                for text in stream.text_stream:
                    buffer += text
                    # Check for action markers in the buffer
                    action_match = re.search(r"<<<ACTION:(\w+)>>>", buffer)
                    if action_match:
                        # Send the text before the marker
                        before = buffer[:action_match.start()].strip()
                        if before:
                            yield sse("token", {"content": before})
                        # Send the action event
                        yield sse("action", {"type": action_match.group(1)})
                        # Clear the buffer past the marker
                        buffer = buffer[action_match.end():]
                    else:
                        # Only flush if we have enough and no partial marker
                        if "<<<" not in buffer and len(buffer) > 5:
                            yield sse("token", {"content": buffer})
                            buffer = ""

                # Flush remaining buffer
                if buffer.strip():
                    # Check one more time for action marker
                    action_match = re.search(r"<<<ACTION:(\w+)>>>", buffer)
                    if action_match:
                        before = buffer[:action_match.start()].strip()
                        if before:
                            yield sse("token", {"content": before})
                        yield sse("action", {"type": action_match.group(1)})
                        after = buffer[action_match.end():].strip()
                        if after:
                            yield sse("token", {"content": after})
                    else:
                        yield sse("token", {"content": buffer})

            yield sse("done", {})
        except Exception as e:
            yield sse("error", {"message": str(e)})

    return StreamingResponse(generate(), media_type="text/event-stream")

# ---------------------------------------------------------------------------
# 2. POST /api/generate-dataset — Real Claude call
# ---------------------------------------------------------------------------

@app.post("/api/generate-dataset")
async def generate_dataset(req: DatasetRequest):
    prompt = f"""Generate exactly {req.num_examples} training examples for fine-tuning {req.base_model} on this task: {req.task}.

Description: {req.description}

Return ONLY a valid JSON array. Each element must have "input" and "output" keys.
Make examples diverse, realistic, and high-quality. Vary length and complexity.
Do NOT include any text before or after the JSON array.

Example format:
[
  {{"input": "example input text", "output": "expected output"}},
  ...
]"""

    try:
        response = client.messages.create(
            model=FAST_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        # Extract JSON array from response
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            examples = json.loads(match.group())
        else:
            examples = json.loads(text)
        return {"examples": examples, "count": len(examples)}
    except Exception as e:
        return {"examples": [], "count": 0, "error": str(e)}

# ---------------------------------------------------------------------------
# 3. POST /api/generate-code — Real Claude call
# ---------------------------------------------------------------------------

@app.post("/api/generate-code")
async def generate_code(req: CodeRequest):
    sample_str = json.dumps(req.dataset_sample[:3], indent=2) if req.dataset_sample else "[]"
    prompt = f"""Write a complete, production-ready Python fine-tuning script for {req.base_model} using HuggingFace Transformers + PEFT (LoRA).

Task: {req.task}
Dataset sample:
{sample_str}

Requirements:
- Use AutoModelForCausalLM and AutoTokenizer
- Use LoRA with r=16, alpha=32, dropout=0.05
- Load dataset from a local JSONL file
- TrainingArguments with: lr=2e-4, 3 epochs, batch_size=4, gradient_accumulation_steps=4
- Save the model at the end
- Include proper tokenization with padding
- Add wandb logging (optional)
- Add comments explaining each section

Output ONLY the Python code. No markdown fences. No explanation text."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        code = response.content[0].text.strip()
        # Strip markdown fences if present
        code = re.sub(r"^```(?:python)?\n?", "", code)
        code = re.sub(r"\n?```$", "", code)
        return {"code": code, "lines": code.count("\n") + 1}
    except Exception as e:
        return {"code": f"# Error generating code: {e}", "lines": 1}

# ---------------------------------------------------------------------------
# 4. POST /api/scan — NERVE GPU scan (mock fallback)
# ---------------------------------------------------------------------------

MOCK_SCAN = {
    "best": {
        "gpu_name": "NVIDIA A100 80GB",
        "sku": "Standard_NC24ads_A100_v4",
        "region": "UK South",
        "region_id": "uksouth",
        "spot_price_usd_hr": 0.31,
        "ondemand_price_usd_hr": 3.67,
        "savings_pct": 91.6,
        "carbon_intensity_gco2_kwh": 45,
        "carbon_index": "very low",
        "temperature_c": 12,
        "wind_kmh": 18,
        "nerve_score": 0.142,
        "total_cost_estimate_usd": 1.24,
        "total_co2_grams": 54,
        "strategy": "immediate",
    },
    "alternatives": [
        {
            "gpu_name": "NVIDIA A100 80GB",
            "region": "North Europe",
            "spot_price_usd_hr": 0.35,
            "savings_pct": 90.5,
            "carbon_intensity_gco2_kwh": 38,
            "nerve_score": 0.168,
        },
        {
            "gpu_name": "NVIDIA V100 16GB",
            "region": "West Europe",
            "spot_price_usd_hr": 0.12,
            "savings_pct": 88.2,
            "carbon_intensity_gco2_kwh": 95,
            "nerve_score": 0.201,
        },
    ],
    "regions_scanned": 12,
    "gpus_found": 47,
}

@app.post("/api/scan")
async def scan_gpu(req: ScanRequest):
    # Try real NERVE engine first
    try:
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
        from engine.scraper import get_cache
        cache = get_cache()
        if cache and len(cache) > 0:
            # Real data available — use it
            # For now, return mock since scraper needs to be running
            pass
    except Exception:
        pass

    # Return mock data (realistic values from real NERVE scraper)
    return MOCK_SCAN

# ---------------------------------------------------------------------------
# 5. POST /api/deploy — Simulated training SSE
# ---------------------------------------------------------------------------

@app.post("/api/deploy")
async def deploy_training(req: DeployRequest):
    async def training_stream():
        total_steps = req.total_steps
        start_loss = 2.5

        yield sse("status", {"message": "Uploading training code...", "progress": 2})
        await asyncio.sleep(1.5)

        yield sse("status", {"message": f"Provisioning {req.gpu} in UK South...", "progress": 5})
        await asyncio.sleep(2)

        yield sse("status", {"message": "Loading model weights...", "progress": 8})
        await asyncio.sleep(1.5)

        yield sse("status", {"message": "Training started.", "progress": 10})
        await asyncio.sleep(0.5)

        eviction_step = int(total_steps * 0.6)
        events = []

        for step in range(1, total_steps + 1):
            progress = step / total_steps
            loss = start_loss * math.exp(-3.5 * progress) + 0.15 + random.gauss(0, 0.02)
            loss = max(0.05, loss)
            lr = 2e-4 * (1 - progress * 0.9)
            epoch = min(3, (step * 3) // total_steps + 1)
            pct = 10 + int(progress * 70)

            yield sse("log", {
                "epoch": epoch,
                "step": step,
                "total_steps": total_steps,
                "loss": round(loss, 4),
                "lr": round(lr, 7),
                "progress": pct,
            })

            # Checkpoint every 60 steps
            if step % 60 == 0:
                evt = {"type": "checkpoint", "step": step, "size_gb": 1.2}
                events.append(evt)
                yield sse("checkpoint", evt)

            # Eviction at 60%
            if step == eviction_step:
                evt = {"type": "eviction", "from_az": "uk-south-2", "to_az": "uk-south-1"}
                events.append(evt)
                yield sse("eviction", evt)
                await asyncio.sleep(2)
                evt2 = {"type": "migrated", "recovery_sec": 28, "data_loss": 0}
                events.append(evt2)
                yield sse("migrated", evt2)

            await asyncio.sleep(0.08)

        # Training complete
        final_loss = round(loss, 4)
        yield sse("status", {"message": "Training complete. Running evaluation...", "progress": 85})
        await asyncio.sleep(2)

        # Auto-eval v1
        yield sse("eval", {
            "version": 1,
            "accuracy": 78.4,
            "f1": 0.76,
            "loss": round(final_loss + 0.1, 4),
            "note": "Weak on edge cases and ambiguous inputs.",
        })
        await asyncio.sleep(2)

        yield sse("status", {"message": "Augmenting dataset with edge cases. Retraining v2...", "progress": 90})
        await asyncio.sleep(3)

        # Auto-eval v2
        yield sse("eval", {
            "version": 2,
            "accuracy": 94.2,
            "f1": 0.93,
            "loss": round(final_loss * 0.6, 4),
            "note": "Significant improvement. Ready for production.",
        })
        await asyncio.sleep(1)

        yield sse("complete", {
            "final_loss": round(final_loss * 0.6, 4),
            "accuracy": 94.2,
            "total_time": "42m 18s",
            "cost_usd": 2.96,
            "co2_grams": 54,
            "checkpoints": len([e for e in events if e.get("type") == "checkpoint"]),
            "evictions": 1,
            "eviction_recovery_sec": 28,
            "model_id": f"eve-{random.randint(1000,9999)}",
        })

    return StreamingResponse(training_stream(), media_type="text/event-stream")

# ---------------------------------------------------------------------------
# 6. POST /api/playground — Claude few-shot as "fine-tuned model"
# ---------------------------------------------------------------------------

@app.post("/api/playground")
async def playground(req: PlaygroundRequest):
    examples_text = "\n\n".join(
        [f"Input: {e.get('input', '')}\nOutput: {e.get('output', '')}" for e in req.examples[:8]]
    )
    prompt = f"""You are a fine-tuned AI model specialized in: {req.task}

You were trained on examples like these:

{examples_text}

Now process this new input. Respond ONLY with the output, matching the exact style and format of the training examples above. No explanation, no preamble.

Input: {req.input_text}
Output:"""

    try:
        response = client.messages.create(
            model=FAST_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        return {"output": response.content[0].text.strip()}
    except Exception as e:
        return {"output": f"Error: {e}"}

# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "eve"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
