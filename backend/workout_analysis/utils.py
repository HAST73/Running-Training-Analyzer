import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return R * c


def parse_gpx(gpx_bytes: bytes) -> List[Dict[str, Optional[float]]]:
    """Parse minimal GPX into a list of dicts: lat, lon, ele, ts (seconds).

    This uses stdlib XML to avoid extra deps. Returns an empty list on error.
    """
    try:
        root = ET.fromstring(gpx_bytes)
    except Exception:
        return []

    ns = {"gpx": root.tag.split("}")[0].strip("{") if "}" in root.tag else ""}

    points: List[Dict[str, Optional[float]]] = []
    # try both with and without namespace
    candidates = root.findall(".//{*}trkpt")
    if not candidates:
        candidates = root.findall(".//trkpt")

    for pt in candidates:
        try:
            lat = float(pt.attrib.get("lat"))
            lon = float(pt.attrib.get("lon"))
        except Exception:
            continue
        ele_el = None
        time_el = None
        ext_el = None
        for ch in pt:
            tag = ch.tag.split("}")[-1]
            if tag == "ele":
                ele_el = ch
            elif tag == "time":
                time_el = ch
            elif tag == "extensions":
                ext_el = ch
        ele: Optional[float] = None
        if ele_el is not None and ele_el.text:
            try:
                ele = float(ele_el.text)
            except Exception:
                ele = None
        ts: Optional[float] = None
        if time_el is not None and time_el.text:
            t = time_el.text.strip()
            try:
                # common GPX format e.g. 2024-10-10T18:25:43Z
                if t.endswith("Z"):
                    t_dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
                else:
                    t_dt = datetime.fromisoformat(t)
                ts = t_dt.replace(tzinfo=timezone.utc).timestamp()
            except Exception:
                ts = None
        # cadence/heart-rate from extensions if present
        cad: Optional[float] = None
        hr: Optional[float] = None
        if ext_el is not None:
            # Walk descendants to find localname cad/hr regardless of namespace
            for d in ext_el.iter():
                name = d.tag.split("}")[-1]
                if name.lower() in ("cad", "cadence") and d.text:
                    try:
                        cad = float(d.text)
                    except Exception:
                        pass
                if name.lower() in ("hr", "heartrate") and d.text:
                    try:
                        hr = float(d.text)
                    except Exception:
                        pass
        points.append({"lat": lat, "lon": lon, "ele": ele, "ts": ts, "cad": cad, "hr": hr})

    return points


def analyze_track(points: List[Dict[str, Optional[float]]]) -> Dict[str, Any]:
    """Compute basic analysis metrics given parsed points.

    Returns dict with: summary, track (with pace per segment), splits,
    pace_changes, best_segments (1k, 5k, 400m, 60s), and chart series.
    """
    if len(points) < 2:
        return {
            "summary": {"distance_m": 0.0, "duration_s": 0.0, "avg_pace_s_per_km": None},
            "track": [],
            "splits": [],
            "best_segments": {},
            "pace_extremes": {"fastest": [], "slowest": []},
            "chart": {"km": [], "pace_s": [], "elev": []},
        }

    # sort by timestamp when available to avoid shuffles
    pts = sorted(points, key=lambda p: (p.get("ts") is None, p.get("ts")))

    track: List[Dict[str, Optional[float]]] = []
    total_dist = 0.0
    total_time = 0.0
    total_elev_gain = 0.0
    # --- HEART RATE agregacja ---
    hr_sum = 0.0
    hr_cnt = 0
    max_hr = None

    km_bucket_hr_sum = 0.0
    km_bucket_hr_cnt = 0
    cad_sum = 0.0
    cad_cnt = 0
    km_bucket_dist = 0.0
    km_bucket_time = 0.0
    km_bucket_elev = 0.0
    km_bucket_cad_sum = 0.0
    km_bucket_cad_cnt = 0
    km_index = 1
    splits: List[Dict[str, Any]] = []

    # For charting we store samples each ~100 m
    chart_km: List[float] = []
    chart_pace: List[Optional[float]] = []
    chart_ele: List[Optional[float]] = []

    last = pts[0]
    accum_since_sample = 0.0

    for cur in pts[1:]:
        d = _haversine_m(last["lat"], last["lon"], cur["lat"], cur["lon"])
        dt = None
        if isinstance(last.get("ts"), (int, float)) and isinstance(cur.get("ts"), (int, float)):
            dt = float(cur["ts"]) - float(last["ts"]) if float(cur["ts"]) >= float(last["ts"]) else None

        pace_s = None
        if d and dt and d > 0 and dt > 0:
            pace_s = dt / (d / 1000.0)

        track.append({
            "lat": cur["lat"],
            "lon": cur["lon"],
            "ele": cur.get("ele"),
            "ts": cur.get("ts"),
            "cad": cur.get("cad"),
            "pace_s": pace_s,
            "seg_m": d,
            "seg_s": dt,
        })

        total_dist += d
        if dt:
            total_time += dt
        # elevation gain (only positive diffs)
        if cur.get("ele") is not None and last.get("ele") is not None:
            diff = float(cur["ele"]) - float(last["ele"])
            if diff > 0:
                total_elev_gain += diff
                km_bucket_elev += diff
        # cadence accumulation
        cval = cur.get("cad")
        if isinstance(cval, (int, float)):
            cad_sum += float(cval)
            cad_cnt += 1
            km_bucket_cad_sum += float(cval)
            km_bucket_cad_cnt += 1
        km_bucket_dist += d
        if dt:
            km_bucket_time += dt

        # heart-rate accumulation
        hval = cur.get("hr")
        if isinstance(hval, (int, float)):
            h = float(hval)
            hr_sum += h
            hr_cnt += 1
            km_bucket_hr_sum += h
            km_bucket_hr_cnt += 1
            if max_hr is None or h > max_hr:
                max_hr = h

        # Sample for chart ~ every 100m
        accum_since_sample += d
        if accum_since_sample >= 100.0:
            accum_since_sample = 0.0
            chart_km.append(total_dist / 1000.0)
            chart_pace.append(pace_s)
            chart_ele.append(cur.get("ele"))

        # Close 1 km splits
        while km_bucket_dist >= 1000.0:
            over = km_bucket_dist - 1000.0
            # prorate time for overrun if available
            split_time = km_bucket_time
            if dt and d > 0 and over > 0 and km_bucket_time:
                # portion attributable to overrun distance
                ratio = over / d
                split_time = km_bucket_time - ratio * dt
                # remaining carried to next split
                km_bucket_time = ratio * dt
            else:
                km_bucket_time = 0.0

            splits.append({
                "km": km_index,
                "pace_s": (split_time / 1.0) if split_time else None,
                "elev_gain_m": km_bucket_elev if km_bucket_elev else 0.0,
                "cadence_spm": (km_bucket_cad_sum / km_bucket_cad_cnt) if km_bucket_cad_cnt else None,
                "hr_bpm": (km_bucket_hr_sum / km_bucket_hr_cnt) if km_bucket_hr_cnt else None,
            })
            km_index += 1
            km_bucket_dist = over
            km_bucket_elev = 0.0
            km_bucket_cad_sum = 0.0
            km_bucket_cad_cnt = 0
            km_bucket_hr_sum = 0.0      # <-- DODAJ
            km_bucket_hr_cnt = 0        # <-- DODAJ

        last = cur

    avg_pace = (total_time / (total_dist / 1000.0)) if total_dist > 0 and total_time > 0 else None
    avg_cadence = (cad_sum / cad_cnt) if cad_cnt else None
    avg_hr = (hr_sum / hr_cnt) if hr_cnt else None

    # Compute ~200m fastest/slowest windows (by pace)
    fast_200: List[Tuple[float, float]] = []
    slow_200: List[Tuple[float, float]] = []
    window_dist = 0.0
    window_time = 0.0
    start_idx = 0
    # sliding over segments
    for i in range(len(track)):
        window_dist += track[i]["seg_m"] or 0.0
        window_time += track[i]["seg_s"] or 0.0
        while window_dist >= 200.0 and start_idx <= i:
            if window_time and window_dist:
                pace = window_time / (window_dist / 1000.0)
                fast_200.append((pace, i))
                slow_200.append((pace, i))
            # pop from left
            window_dist -= track[start_idx]["seg_m"] or 0.0
            window_time -= track[start_idx]["seg_s"] or 0.0
            start_idx += 1

    fast_200.sort(key=lambda x: x[0])
    slow_200.sort(key=lambda x: x[0], reverse=True)
    pace_extremes = {
        "fastest": [
            {"pace_s": p, "window": "~200m"} for p, _ in fast_200[:5]
        ],
        "slowest": [
            {"pace_s": p, "window": "~200m"} for p, _ in slow_200[:5]
        ],
    }

    def best_by_distance(target_m: float) -> Optional[float]:
        wd = 0.0
        wt = 0.0
        best: Optional[float] = None
        s = 0
        for i in range(len(track)):
            wd += track[i]["seg_m"] or 0.0
            wt += track[i]["seg_s"] or 0.0
            while wd >= target_m and s <= i:
                if wt and wd:
                    pace = wt / (wd / 1000.0)
                    best = pace if best is None or pace < best else best
                wd -= track[s]["seg_m"] or 0.0
                wt -= track[s]["seg_s"] or 0.0
                s += 1
        return best

    best_segments = {
        "best_1k_pace_s": best_by_distance(1000.0),
        "best_5k_pace_s": best_by_distance(5000.0),
        "best_400m_pace_s": best_by_distance(400.0),
        "best_60s_pace_s": None,  # optional: needs time-window search
    }

    # crude calories estimate ~ 1.036 kcal per kg per km
    def estimate_calories(distance_m: float, weight_kg: float = 70.0) -> float:
        return 1.036 * weight_kg * (distance_m / 1000.0)

    return {
        "summary": {
            "distance_m": total_dist,
            "duration_s": total_time,
            "avg_pace_s_per_km": avg_pace,
            "elev_gain_m": total_elev_gain,
            "avg_cadence_spm": avg_cadence,
            "avg_hr_bpm": avg_hr,
            "max_hr_bpm": max_hr,
            "calories_kcal": estimate_calories(total_dist),
        },
        "track": track,
        "splits": splits,
        "best_segments": best_segments,
        "pace_extremes": pace_extremes,
        "chart": {"km": chart_km, "pace_s": chart_pace, "elev": chart_ele},
    }
