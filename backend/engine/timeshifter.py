"""
NERVE Engine — Live Time-Shifter
Utilise les VRAIS prix scrapes + meteo pour trouver le creneau optimal.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from models import TimeShiftPlan, TimeShiftRequest
from engine.scraper import get_live_weather, get_cache


def _build_live_price_curve(region_id: str) -> dict[int, float]:
    """
    Build a price curve from real scraped data.
    Uses average spot price + known Spot intra-day variation patterns.
    """
    cache = get_cache()
    gpus = cache.get("gpu_prices", {}).get(region_id, [])

    if not gpus:
        return {h: 0.5 for h in range(24)}

    avg_price = sum(g["spot_price_usd_hr"] for g in gpus) / len(gpus)

    # Intra-day multipliers (empirical Spot market data)
    INTRADAY = {
        0: 0.72, 1: 0.65, 2: 0.60, 3: 0.58, 4: 0.60, 5: 0.65,
        6: 0.75, 7: 0.85, 8: 0.92, 9: 0.98, 10: 1.05, 11: 1.10,
        12: 1.12, 13: 1.10, 14: 1.05, 15: 0.98, 16: 0.92, 17: 0.88,
        18: 0.82, 19: 0.78, 20: 0.75, 21: 0.73, 22: 0.72, 23: 0.72,
    }

    return {h: round(avg_price * factor, 4) for h, factor in INTRADAY.items()}


def _build_live_carbon_curve(region_id: str) -> dict[int, float]:
    """Build carbon curve from real weather data (wind/solar reduce carbon)."""
    weather = get_live_weather(region_id)
    hourly = weather.get("hourly", [])

    if not hourly:
        return {h: 100.0 for h in range(24)}

    cache = get_cache()
    base_carbon = cache.get("carbon", {}).get(region_id, {}).get("gco2_kwh", 100.0)

    curve = {}
    for i in range(24):
        if i < len(hourly):
            entry = hourly[i]
            wind = entry.get("wind_kmh", 15.0)
            solar = entry.get("solar_wm2", 0.0)
            wind_factor = max(0.7, 1.0 - (wind / 100.0))
            solar_factor = max(0.8, 1.0 - (solar / 500.0))
            curve[i] = round(base_carbon * wind_factor * solar_factor, 1)
        else:
            curve[i] = base_carbon

    return curve


def _find_optimal_window(
    hours_needed: float,
    deadline: datetime,
    region_id: str,
) -> tuple[Optional[datetime], Optional[datetime], float, float]:
    """Find optimal start time using LIVE price + carbon curves."""
    now = datetime.now(timezone.utc)
    hours_int = int(hours_needed) + 1

    hours_until_deadline = (deadline - now).total_seconds() / 3600
    if hours_until_deadline < hours_needed:
        return None, None, 0.0, 0.0

    price_curve = _build_live_price_curve(region_id)
    carbon_curve = _build_live_carbon_curve(region_id)

    best_start_hour = None
    best_cost = float("inf")

    max_offset = int(hours_until_deadline - hours_needed) + 1
    for start_offset_h in range(max_offset):
        candidate_start = now + timedelta(hours=start_offset_h)
        total_cost = 0.0
        for h in range(hours_int):
            run_hour = (candidate_start.hour + h) % 24
            total_cost += price_curve.get(run_hour, 1.0)

        if total_cost < best_cost:
            best_cost = total_cost
            best_start_hour = start_offset_h

    if best_start_hour is None:
        return None, None, 0.0, 0.0

    optimal_start = now + timedelta(hours=best_start_hour)
    optimal_end = optimal_start + timedelta(hours=hours_needed)

    current_cost = sum(
        price_curve.get((now.hour + h) % 24, 1.0) for h in range(hours_int)
    )
    price_reduction = ((current_cost - best_cost) / current_cost * 100) if current_cost > 0 else 0

    current_carbon = sum(
        carbon_curve.get((now.hour + h) % 24, 100.0) for h in range(hours_int)
    )
    optimal_carbon = sum(
        carbon_curve.get((optimal_start.hour + h) % 24, 100.0) for h in range(hours_int)
    )
    carbon_reduction = (
        (current_carbon - optimal_carbon) / current_carbon * 100
    ) if current_carbon > 0 else 0

    return optimal_start, optimal_end, max(price_reduction, 0), max(carbon_reduction, 0)


async def should_time_shift(
    deadline: datetime,
    gpu_hours: float,
    region_id: str = "francecentral",
) -> dict:
    """Determine if time-shifting is recommended using live data."""
    start, end, price_red, carbon_red = _find_optimal_window(gpu_hours, deadline, region_id)

    if start and price_red > 5:
        return {
            "recommended": True,
            "optimal_start": start,
            "optimal_end": end,
            "price_reduction_pct": price_red,
            "carbon_reduction_pct": carbon_red,
        }
    return {"recommended": False, "optimal_start": None}


async def compute_timeshift_plan(req: TimeShiftRequest) -> TimeShiftPlan:
    """Compute full time-shifting plan using LIVE data."""
    region_id = req.preferred_region or "francecentral"

    start, end, price_red, carbon_red = _find_optimal_window(
        req.estimated_gpu_hours, req.deadline, region_id
    )

    recommended = start is not None and price_red > 5 and req.flexible
    meets_deadline = True
    if end and end > req.deadline:
        recommended = False
        meets_deadline = False

    price_curve = _build_live_price_curve(region_id)
    now_hour = datetime.now(timezone.utc).hour
    current_price = price_curve.get(now_hour, 1.0)
    optimal_price = price_curve.get(start.hour, 1.0) if start else current_price

    return TimeShiftPlan(
        recommended=recommended,
        optimal_window_start=start,
        optimal_window_end=end,
        reason=(
            f"Decaler le job a {start.strftime('%Hh%M') if start else 'N/A'} "
            f"reduit le cout de {price_red:.0f}% et le carbone de {carbon_red:.0f}% "
            f"(donnees live {region_id})"
            if recommended
            else "Le creneau actuel est optimal ou la deadline ne permet pas de decaler"
        ),
        estimated_spot_price_usd_hr=round(optimal_price, 4),
        current_spot_price_usd_hr=round(current_price, 4),
        price_reduction_pct=round(price_red, 1),
        carbon_reduction_pct=round(carbon_red, 1),
        meets_deadline=meets_deadline,
    )
