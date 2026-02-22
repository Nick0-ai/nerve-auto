# NERVE Auto

**An AI that fine-tunes AI models from scratch.**

You describe what you want in plain language — like ChatGPT — and NERVE Auto handles everything else.

## What it does

1. **You send a prompt** — "Fine-tune Llama 70B on my customer support dataset" or "Train a sentiment classifier on these reviews"
2. **NERVE generates the training code** — model config, data pipeline, hyperparameters, training loop
3. **NERVE finds the best server** — scans 12 cloud regions in real-time, compares Spot GPU prices, carbon intensity, eviction risk
4. **NERVE deploys and trains** — uploads the code to the cheapest GPU, launches training, checkpoints every 30s
5. **NERVE handles failures** — if the Spot instance gets evicted, it migrates to a new GPU in 28 seconds with zero data loss
6. **You get your model** — trained, optimized, delivered. You never touched a terminal.

## The vision

Today, fine-tuning a model requires:
- Writing training scripts
- Choosing a cloud provider and GPU
- Managing Spot evictions
- Monitoring carbon footprint
- Handling checkpointing and recovery

NERVE Auto removes all of that. One prompt in, one model out.

**From $88 on-demand to $7.44 with Spot — and you didn't write a single line of code.**

## Architecture

```
User prompt
    |
    v
[Code Generator] -- generates training script + config
    |
    v
[NERVE Scanner] -- scans 12 regions, compares price/carbon/risk
    |
    v
[Deployer] -- uploads code to cheapest Spot GPU
    |
    v
[Training Engine] -- runs training, checkpoint every 30s
    |
    v
[Migration Engine] -- auto-migrates on eviction (28s recovery)
    |
    v
Trained model delivered
```

## What's in this repo

- `backend/` — Python backend engine (scoring, scraping, checkpointing, time-shifting, LLM integration)
- `supabase/` — Edge functions (GPU price scraping, carbon data, weather, simulation, optimization, WebSocket feed)
- `supabase/migrations/` — Database schema

## Stack

- **Backend**: Python (FastAPI)
- **Edge Functions**: Deno (Supabase)
- **Cloud**: Azure Spot VMs (A100, H100, V100, T4)
- **Regions**: 12 Azure regions (UK South, North Europe, West Europe, East US, etc.)

## Built at Europe Hack 2026

By Nicolas and William.

This is the next version of [NERVE](https://github.com/Wasroy/Wattless) — from GPU orchestrator to fully autonomous AI training platform.
