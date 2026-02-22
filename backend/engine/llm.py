"""
NERVE Engine — Real LLM Integration
Envoie le JSON scrappe live + preprompt au LLM pour decision.
Supporte : Groq (LLaMA), Google Gemini, Anthropic Claude, OpenAI GPT.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path

log = logging.getLogger("nerve.llm")

_PREPROMPT_PATHS = [
    Path(__file__).resolve().parent.parent.parent / "vision" / "nerve_llm_preprompt.txt",
    Path(__file__).resolve().parent.parent / "data" / "nerve_llm_preprompt.txt",
]


def _load_preprompt() -> str:
    for path in _PREPROMPT_PATHS:
        if path.exists():
            return path.read_text(encoding="utf-8")
    return (
        "Tu es NERVE, un moteur d'optimisation FinOps/GreenOps pour le Cloud Computing GPU. "
        "Analyse les donnees JSON fournies et retourne ta decision au format JSON."
    )


def _get_provider() -> str:
    return os.getenv("NERVE_LLM_PROVIDER", "none")


def _get_model() -> str:
    defaults = {"groq": "llama-3.1-8b-instant", "gemini": "gemini-2.0-flash", "anthropic": "claude-sonnet-4-20250514", "openai": "gpt-4o-mini"}
    return os.getenv("NERVE_LLM_MODEL", defaults.get(_get_provider(), ""))


async def call_nerve_llm(scraped_json: str) -> dict:
    """Send preprompt + live scraped JSON to real LLM API."""
    provider = _get_provider()
    preprompt = _load_preprompt()
    full_prompt = preprompt + "\n" + scraped_json

    log.info(f"LLM call — provider={provider}, prompt_len={len(full_prompt)}")

    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return {"status": "error", "message": "GROQ_API_KEY not set in .env"}
        try:
            import openai
            client = openai.OpenAI(api_key=api_key, base_url="https://api.groq.com/openai/v1")
            response = client.chat.completions.create(
                model=_get_model(),
                messages=[
                    {"role": "system", "content": preprompt},
                    {"role": "user", "content": scraped_json},
                ],
                max_tokens=4096,
            )
            return _extract_json(response.choices[0].message.content)
        except Exception as e:
            log.error(f"Groq API error: {e}")
            return {"status": "error", "message": str(e)}

    if provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {"status": "error", "message": "GEMINI_API_KEY not set in .env"}
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model=_get_model(),
                contents=full_prompt,
            )
            return _extract_json(response.text)
        except Exception as e:
            log.error(f"Gemini API error: {e}")
            return {"status": "error", "message": str(e)}

    if provider == "anthropic":
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            return {"status": "error", "message": "ANTHROPIC_API_KEY not set in .env"}
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=api_key)
            response = client.messages.create(
                model=_get_model(),
                max_tokens=4096,
                messages=[{"role": "user", "content": full_prompt}],
            )
            return _extract_json(response.content[0].text)
        except Exception as e:
            log.error(f"Anthropic API error: {e}")
            return {"status": "error", "message": str(e)}

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return {"status": "error", "message": "OPENAI_API_KEY not set in .env"}
        try:
            import openai
            client = openai.OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=_get_model(),
                messages=[
                    {"role": "system", "content": preprompt},
                    {"role": "user", "content": scraped_json},
                ],
                max_tokens=4096,
                response_format={"type": "json_object"},
            )
            return _extract_json(response.choices[0].message.content)
        except Exception as e:
            log.error(f"OpenAI API error: {e}")
            return {"status": "error", "message": str(e)}

    return {
        "status": "no_provider",
        "message": f"Set NERVE_LLM_PROVIDER=groq|gemini|anthropic|openai in .env",
        "prompt_length": len(full_prompt),
    }


def _extract_json(text: str) -> dict:
    """Extract JSON from LLM response (handles markdown fences)."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        try:
            return json.loads(text[start:end].strip())
        except json.JSONDecodeError:
            pass
    first = text.find("{")
    last = text.rfind("}")
    if first >= 0 and last > first:
        try:
            return json.loads(text[first:last + 1])
        except json.JSONDecodeError:
            pass
    return {"status": "parse_error", "raw_response": text[:2000]}


async def build_llm_context() -> str:
    """Build compact JSON context from live scraped data for LLM."""
    from engine.scraper import get_cache
    cache = get_cache()

    # Compact: only top-5 cheapest GPUs per region + weather + carbon
    compact_prices = {}
    for region_id, gpus in cache.get("gpu_prices", {}).items():
        if not gpus:
            continue
        sorted_gpus = sorted(gpus, key=lambda g: g.get("spot_price_usd_hr", 999))[:5]
        compact_prices[region_id] = [
            {
                "sku": g["sku"],
                "gpu": g["gpu_name"],
                "spot": round(g["spot_price_usd_hr"], 4),
                "ondemand": round(g["ondemand_price_usd_hr"], 2),
                "save%": round(g["savings_pct"], 1),
            }
            for g in sorted_gpus
        ]

    context = {
        "ts": cache.get("last_scrape"),
        "prices": compact_prices,
        "weather": cache.get("weather", {}),
        "carbon": cache.get("carbon", {}),
    }
    return json.dumps(context, separators=(",", ":"), default=str)
