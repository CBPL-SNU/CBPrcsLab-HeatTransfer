#!/usr/bin/env python3
# /// script
# dependencies = ["numpy", "scipy", "pillow"]
# ///

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

from cfd_to_frames import Resampler, to_sprite

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "data" / "cfd"

# 실험 B는 가열된 관 벽이 130~190 °C이고 구 주변 공기는 수 K만 오른다. 한 색 범위로 그리면
# 구 주변이 한 색으로 뭉개지므로, 같은 단면을 두 창으로 잘라 창마다 색 범위를 따로 잡는다.
# xz와 yz는 평균 0.004 K 차이라 xz 하나만 쓴다.
PLANE_AXIS = 0                    # xz 평면(y = 0)은 x가 가로
VIEWS = {
    # 가열 구간(z ≈ 0.63~0.77 m)과 그 위아래 여유. 그 밖은 균일한 유입 공기다
    "full": {"zLo": 0.58, "zHi": 0.82, "xLo": -0.035, "xHi": 0.035, "pxPerM": 1000},
}
# 구 주변 창은 구 지름에 맞춘다. 큰 구(3.1 mm)는 ±8 mm, 작은 구(0.5 mm)는 ±1.5 mm.
# 어느 쪽이든 160 px로 그린다. 구 주변 격자가 큰 구 0.09 mm, 작은 구 0.044 mm라 데이터가 받쳐 준다
ZOOM_DIAMETERS = 2.5              # 창 반폭 = 구 지름 × 이 값, 0.5 mm 단위로 올림
ZOOM_PX = 160
SMOOTH_SIGMA = 1.0                # px. 삼각화 흔적만 지운다
# 자연대류는 정지 상태에서 출발해 0.7~0.9 s에 100 °C 가까운 공기 덩어리가 구 위를 한 번 지나간다.
# 이 세 프레임으로 구 주변 창의 색 범위를 잡으면 나머지 60 s가 한 색으로 뭉개지므로 범위에서 뺀다.
# 빠진 프레임은 위쪽 색으로 포화되고, index에 clipped로 남겨 판독값에 ≥를 붙인다
RANGE_SKIP_S = {"zoom": 1.0}


def grid(view):
    w = int(round((view["xHi"] - view["xLo"]) * view["pxPerM"]))
    h = int(round((view["zHi"] - view["zLo"]) * view["pxPerM"]))
    lateral = view["xLo"] + (np.arange(w) + 0.5) / view["pxPerM"]
    z = view["zHi"] - (np.arange(h) + 0.5) / view["pxPerM"]
    return w, h, np.meshgrid(lateral, z)


def clean(values):
    return [None if not math.isfinite(v) else round(float(v), 5) for v in values]


def convert(raw_dir, case, jacket_K=None):
    raw_dir = Path(raw_dir)
    out_dir = OUT / case
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = json.loads((raw_dir / "metadata.json").read_text(encoding="utf-8"))
    info = meta["source_case_info"]

    air = np.load(raw_dir / "xz_air.npz")
    bead = np.load(raw_dir / "xz_bead.npz")
    # npz는 인덱싱할 때마다 배열 전체를 다시 압축 해제한다. 한 번만 꺼낸다.
    time_s = air["time_s"]
    air_pts, bead_pts = air["points_m"], bead["points_m"]
    air_T, bead_T = air["T_K"], bead["T_K"]
    air_speed = np.linalg.norm(air["U_m_per_s"], axis=2)
    pts = np.vstack([air_pts, bead_pts])
    # 구 안의 속도는 0이다
    speed_all = np.hstack([air_speed, np.zeros((len(time_s), len(bead_pts)), dtype=np.float32)])
    T_all = np.hstack([air_T, bead_T]) - 273.15

    centre = bead_pts.mean(axis=0)
    radius = float(np.linalg.norm(bead_pts - centre, axis=1).max())
    # B00_17V_big 메타데이터에는 벽 온도가 빠져 있어 인자로 받는다 (같은 17 V 실측 484.9 K)
    jacket_K = info.get("jacket_K", jacket_K)
    jacket_C = jacket_K - 273.15
    # 가열 벽면 범위는 메타데이터에 없어 마지막 프레임에서 벽 온도에 닿은 점으로 찾는다
    hot = air_T[-1] > jacket_K - 0.5
    jacket_z = (float(air_pts[hot, 2].min()), float(air_pts[hot, 2].max()))

    half = math.ceil(2 * radius * ZOOM_DIAMETERS / 0.0005 - 1e-9) * 0.0005
    views = dict(VIEWS, zoom={
        "zLo": round(float(centre[2]) - half, 5), "zHi": round(float(centre[2]) + half, 5),
        "xLo": round(float(centre[0]) - half, 5), "xHi": round(float(centre[0]) + half, 5),
        "pxPerM": round(ZOOM_PX / (2 * half), 3)})

    index = {
        "case": case,
        "source": meta["case"],
        "durationS": round(float(time_s[-1] - time_s[0]), 2),
        "frames": [round(float(t), 2) for t in time_s],
        "ambientC": round(info["ambient_K"] - 273.15, 3),
        "jacket": {"tempC": round(jacket_C, 2), "zLo": round(jacket_z[0], 4), "zHi": round(jacket_z[1], 4)},
        "bead": {"x": round(float(centre[0]), 5), "z": round(float(centre[2]), 5), "radius": round(radius, 6)},
        "planes": {},
    }
    print(f"{case}: {len(time_s)} frames, bead D = {2e3 * radius:.2f} mm, jacket {jacket_C:.1f} °C")

    for name, view in views.items():
        w, h, (glat, gz) = grid(view)
        margin = 4 / view["pxPerM"] + 0.002
        keep = ((pts[:, PLANE_AXIS] >= view["xLo"] - margin) & (pts[:, PLANE_AXIS] <= view["xHi"] + margin)
                & (pts[:, 2] >= view["zLo"] - margin) & (pts[:, 2] <= view["zHi"] + margin))
        resample = Resampler(pts[keep], PLANE_AXIS, glat, gz)
        temps, speeds = [], []
        for i in range(len(time_s)):
            temps.append(gaussian_filter(resample(T_all[i][keep]), SMOOTH_SIGMA).astype(np.float32))
            speeds.append(gaussian_filter(resample(speed_all[i][keep]), SMOOTH_SIGMA).astype(np.float32))
        # 창마다, 조건 안에서 고정. 프레임마다 정규화하면 재생 중 색이 숨쉰다
        counted = time_s >= time_s[0] + RANGE_SKIP_S.get(name, 0)
        t_lo = min(f.min() for f in temps)
        t_hi = max(f.max() for f, c in zip(temps, counted) if c)
        u_hi = max(f.max() for f, c in zip(speeds, counted) if c)
        t_clip = max(f.max() for f in temps) > t_hi + 0.01
        u_clip = max(f.max() for f in speeds) > u_hi + 0.001
        sheet, cols, rows = to_sprite(temps, t_lo, t_hi, w, h)
        Image.fromarray(sheet, "L").save(out_dir / f"{name}_T.png", optimize=True)
        sheet, _, _ = to_sprite(speeds, 0.0, u_hi, w, h)
        Image.fromarray(sheet, "L").save(out_dir / f"{name}_U.png", optimize=True)
        index["planes"][name] = {
            "w": w, "h": h, "cols": cols, "rows": rows,
            "roi": view,
            "range": {"temperature": {"min": round(float(t_lo), 3), "max": round(float(t_hi), 3), "clipped": bool(t_clip)},
                      "speed": {"min": 0.0, "max": round(float(u_hi), 4), "clipped": bool(u_clip)}},
            "temperature": f"{name}_T.png", "speed": f"{name}_U.png",
        }
        print(f"  {name}: {w}×{h} px, {t_lo:.2f}–{t_hi:.2f} °C{' (clipped)' if t_clip else ''}, ≤ {u_hi:.2f} m/s{' (clipped)' if u_clip else ''}")

    hist = np.load(raw_dir / "integrated_histories.npz")
    keys = ["time_s", "T_bead_avg_C", "T_bead_center_C",
            "Q_air_to_bead_conv_W", "Q_air_to_bead_rad_W", "Q_air_to_bead_total_W"]
    (out_dir / "history.json").write_text(json.dumps({k: clean(hist[k]) for k in keys}), encoding="utf-8")
    (out_dir / "index.json").write_text(json.dumps(index, indent=1), encoding="utf-8")
    total = sum(p.stat().st_size for p in out_dir.iterdir())
    print(f"  → {out_dir.relative_to(ROOT)}  {total / 1e6:.2f} MB")


if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        sys.exit("usage: cfd_b_to_frames.py <raw case dir> <case id> [jacket K]")
    convert(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) == 4 else None)
