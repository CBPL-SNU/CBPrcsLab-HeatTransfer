// 600초 센서 3개 계산의 엔진 실행 시간을 측정한다. 화면 렌더링 시간은 포함하지 않는다.
import { performance } from "node:perf_hooks";
import { cpus } from "node:os";
import { simulateSensors } from "../assets/js/physics/lumped.js";

console.log(JSON.stringify({ node: process.version, cpu: cpus()[0]?.model }));
for (const velocity of [0, 0.4, 1.6, 5]) {
  const input = { wall: 145, gas: 25, velocity, initial: 25, t6Emissivity: 0.4, duration: 600 };
  const start = performance.now();
  const result = simulateSensors(input);
  const firstMs = performance.now() - start;
  for (let i = 0; i < 10; i++) simulateSensors(input);
  const times = [];
  for (let i = 0; i < 100; i++) {
    const start = performance.now();
    simulateSensors(input);
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const steps = Object.values(result.integration).reduce((sum, x) => sum + x.steps, 0);
  console.log(JSON.stringify({ velocity, firstMs, medianMs: times[50], p95Ms: times[95], steps, rhsEvaluations: steps * 4, savedPoints: Object.values(result.series).reduce((sum, x) => sum + x.length, 0) }));
}
