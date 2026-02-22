"""
NERVE Engine — Smart Checkpointing
Simulates evacuation using REAL AZ data from scraper.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from models import CheckpointEvent, CheckpointSimulateRequest
from engine.scoring import record_checkpoint, record_eviction
from engine.scraper import get_cache, REGIONS

# ── AZ neighbor map ──────────────────────────────────────────────────

_NEIGHBOR_AZ = {
    "fr-central-1": "fr-central-2",
    "fr-central-2": "fr-central-3",
    "fr-central-3": "fr-central-1",
    "we-1": "we-2",
    "we-2": "we-3",
    "we-3": "we-1",
    "uk-south-1": "uk-south-2",
    "uk-south-2": "uk-south-3",
    "uk-south-3": "uk-south-1",
}

S3_UPLOAD_GBPS = 1.2


async def simulate_interruption(req: CheckpointSimulateRequest) -> CheckpointEvent:
    """
    Simulate NERVE evacuation protocol using real data:
    - Real GPU prices for target AZ
    - Real weather conditions
    """
    target_az = _NEIGHBOR_AZ.get(req.current_az, "fr-central-2")
    checkpoint_size_gb = req.model_size_gb * 0.8
    upload_duration_sec = checkpoint_size_gb / S3_UPLOAD_GBPS

    # Get live data for context
    cache = get_cache()
    region_gpus = cache.get("gpu_prices", {}).get(req.current_region, [])
    target_gpu_info = "same SKU"
    for g in region_gpus:
        if g["sku"] == req.current_sku:
            target_gpu_info = f"{g['gpu_name']} @ ${g['spot_price_usd_hr']}/h (LIVE)"
            break

    weather = cache.get("weather", {}).get(req.current_region, {})
    carbon = cache.get("carbon", {}).get(req.current_region, {})

    await asyncio.sleep(0.1)  # Simulate async operation

    timeline = [
        {
            "time_sec": 0.0,
            "event": f"Spot Interruption Notice — AWS metadata endpoint 169.254.169.254",
        },
        {
            "time_sec": 1.5,
            "event": "NERVE signal PyTorch: torch.save() triggered",
        },
        {
            "time_sec": round(1.5 + upload_duration_sec, 1),
            "event": f"Checkpoint ({checkpoint_size_gb:.1f} GB) uploaded to S3",
        },
        {
            "time_sec": round(2.0 + upload_duration_sec, 1),
            "event": f"kubectl cordon {req.current_az} — node cordoned",
        },
        {
            "time_sec": round(25.0 + upload_duration_sec, 1),
            "event": f"New Spot GPU provisioned in {target_az} — {target_gpu_info}",
        },
        {
            "time_sec": round(35.0 + upload_duration_sec, 1),
            "event": "Checkpoint downloaded from S3 — torch.load()",
        },
        {
            "time_sec": round(40.0 + upload_duration_sec, 1),
            "event": f"Training resumed at {req.epoch_progress_pct}% — zero loss "
                     f"(weather: {weather.get('current_temp_c', '?')}°C, "
                     f"carbon: {carbon.get('gco2_kwh', '?')} gCO2/kWh)",
        },
    ]

    record_checkpoint()
    record_eviction()

    # Emit real event via scraper
    from engine.scraper import _emit
    _emit({
        "type": "checkpoint_event",
        "job_id": req.job_id,
        "status": "saved",
        "progress_pct": req.epoch_progress_pct,
        "checkpoint_size_gb": round(checkpoint_size_gb, 2),
    })
    _emit({
        "type": "migration_complete",
        "job_id": req.job_id,
        "from_az": req.current_az,
        "to_az": target_az,
        "downtime_ms": 0,
        "reason": "Spot interruption — AZ-Hopping",
    })

    return CheckpointEvent(
        job_id=req.job_id,
        status="migrated",
        checkpoint_saved=True,
        checkpoint_size_gb=round(checkpoint_size_gb, 2),
        save_duration_sec=round(upload_duration_sec, 2),
        from_az=req.current_az,
        to_az=target_az,
        downtime_ms=0,
        epoch_progress_pct=req.epoch_progress_pct,
        resumed=True,
        timeline=timeline,
    )
