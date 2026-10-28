# RK 시간 적분과 독립적으로 t = ∫ C / Qnet(T) dT를 구적한다. 표준 라이브러리만 사용한다.
import json
import math
from pathlib import Path


def elapsed(initial, final, rhs, count=8192):
    step = (final - initial) / count
    total = 1 / rhs(initial) + 1 / rhs(final)
    for i in range(1, count):
        total += (4 if i % 2 else 2) / rhs(initial + i * step)
    return step * total / 3


def main():
    data = json.loads((Path(__file__).parent / "reference.json").read_text(encoding="utf-8"))
    c = data["constants"]
    air, material = c["AIR"], c["BEAD_MATERIAL"]
    checks = 0
    max_relative_error = 0.0
    for case in data["lumpedB"]:
        p = case["inputs"]
        for name, points in case["series"].items():
            spec = c["SENSOR_DEFS"][name]
            epsilon = p["t6Emissivity"] if name == "T6" else spec["epsilon"]
            d = spec["d"]
            area = math.pi * d**2
            override = p.get("beadProperties", {}).get(name, {})
            density = override.get("density", material["density"])
            specific_heat = override.get("cp", material["cp"])
            capacity = override.get("thermalCapacity", density * specific_heat * math.pi * d**3 / 6)
            re = p["velocity"] * d / air["nu"]
            h = air["k"] / d * (2 + 0.6 * math.sqrt(re) * air["Pr"]**(1/3))

            def rhs(temp):
                q_rad = epsilon * c["SIGMA"] * air["F"] * area * ((p["wall"] + 273.15)**4 - (temp + 273.15)**4)
                return (q_rad - h * area * (temp - p["gas"])) / capacity

            initial_slope = rhs(p["initial"])
            if abs(initial_slope) < 1e-12:
                assert all(abs(point["temp"] - p["initial"]) < 1e-10 for point in points)
                checks += 1
                continue
            # 평형 부근에서는 역함수가 특이해지므로 초기부터 중간 과도 구간을 비교한다.
            for point in points[1:]:
                if abs(rhs(point["temp"])) < abs(initial_slope) * 0.1:
                    break
                predicted = elapsed(p["initial"], point["temp"], rhs)
                error = abs(predicted - point["t"]) / point["t"]
                max_relative_error = max(max_relative_error, error)
                assert error < 2e-6, (p, name, point, predicted, error)
                checks += 1
    assert checks > 20
    print(f"Quadrature checks: {checks}; max relative time error: {max_relative_error:.3e}")


if __name__ == "__main__":
    main()
