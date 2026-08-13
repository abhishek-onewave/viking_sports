/**
 * verify_parity.mjs — prove the TypeScript inference matches Python exactly.
 *
 *     node scripts/verify_parity.mjs
 *
 * buy-signal.json carries `parity_cases`: real feature rows together with the
 * probability sklearn computed for each. This replays them through the same
 * arithmetic the browser runs and fails if any disagrees beyond 1e-9.
 *
 * This test exists because v1 shipped a silent mismatch: training used
 * np.log10(price), the TypeScript used Math.log1p(price), and nothing raised —
 * the deployed model was simply fed a wrong number and answered confidently.
 * Run this in CI; a green build should mean the browser and the notebook agree.
 *
 * It deliberately re-implements `score()` rather than importing the .ts, so the
 * check stays runnable with plain node and has no build step. If the two ever
 * drift apart this test is the thing that notices.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
// Whatever *-signal.json the exporter produced. Discovering them beats a
// hardcoded list: the item-level classifier was dropped from the browser (as
// Logistic Regression it scored 0.598 against a 0.503 baseline — chance), and a
// stale filename here would have failed the build for the wrong reason.
const MODEL_DIR = join(HERE, "..", "public", "model");
const MODELS = existsSync(MODEL_DIR)
  ? readdirSync(MODEL_DIR).filter((f) => f.endsWith("-signal.json")).sort()
  : [];
if (MODELS.length === 0) {
  console.error("No *-signal.json found in public/model — run npm run export-buy-model");
  process.exit(1);
}

function score(m, raw) {
  const vec = new Map();
  m.numeric.columns.forEach((col, i) => {
    const v = raw[col];
    const num = typeof v === "number" && Number.isFinite(v)
      ? v
      : m.numeric.impute_median[i];
    vec.set(m.numeric.output_names[i],
            (num - m.numeric.mean[i]) / m.numeric.scale[i]);
  });
  for (const cm of m.categorical.maps) {
    const v = raw[cm.column];
    const key = v == null || v === "" ? m.categorical.fill_value : String(v);
    const target = cm.category_to_output[key] ?? cm.infrequent_output;
    if (target) vec.set(target, 1);
  }
  let z = m.intercept;
  m.output_names.forEach((name, i) => {
    z += (vec.get(name) ?? 0) * m.coef[i];
  });
  return 1 / (1 + Math.exp(-z));
}

const TOL = 1e-9;
let failures = 0;
let worstOverall = 0;

for (const file of MODELS) {
const model = JSON.parse(readFileSync(join(HERE, "..", "public", "model", file), "utf8"));
let worst = 0;
console.log(`\n=== ${file} — ${model.parity_cases.length} cases, tolerance ${TOL}`);
console.log(`  ${"case".padEnd(6)}${"python".padStart(14)}${"typescript".padStart(14)}${"diff".padStart(12)}`);

model.parity_cases.forEach((c, i) => {
  const got = score(model, c.input);
  const diff = Math.abs(got - c.expected_proba);
  worst = Math.max(worst, diff);
  const ok = diff <= TOL;
  if (!ok) failures++;
  console.log(
    `  ${String(i).padEnd(6)}${c.expected_proba.toFixed(10).padStart(14)}` +
    `${got.toFixed(10).padStart(14)}${diff.toExponential(2).padStart(12)}` +
    `${ok ? "" : "   <-- MISMATCH"}`,
  );
});

// structural checks: a desync here is exactly how v1 broke
const expectedCols =
  model.numeric.output_names.length +
  model.categorical.maps.reduce(
    (n, m) => n + Object.keys(m.category_to_output).length + (m.infrequent_output ? 1 : 0),
    0,
  );
if (expectedCols !== model.output_names.length) {
  console.error(`\nFAIL: reconstructed ${expectedCols} columns but the model ` +
                `declares ${model.output_names.length}`);
  failures++;
}
if (model.output_names.length !== model.coef.length) {
  console.error(`\nFAIL: ${model.output_names.length} columns vs ` +
                `${model.coef.length} coefficients`);
  failures++;
}

console.log(`  worst difference: ${worst.toExponential(3)}`);
worstOverall = Math.max(worstOverall, worst);
}

console.log(`\nworst difference across all models: ${worstOverall.toExponential(3)}`);
if (failures) {
  console.error(`FAILED — ${failures} problem(s). Do not deploy.`);
  process.exit(1);
}
console.log("PASS — TypeScript inference matches Python exactly for all models.");
