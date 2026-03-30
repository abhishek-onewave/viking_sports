/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * XGBoost native JSON format scorer.
 * XGBoost 2.0+ stores trees as flat arrays, not nested node objects.
 */
interface XGBoostTree {
  base_weights: number[];
  left_children: number[];
  right_children: number[];
  split_conditions: number[];
  split_indices: number[];
  default_left: number[];
}

interface XGBoostModelJSON {
  learner: {
    gradient_booster: {
      model: {
        trees: XGBoostTree[];
      };
    };
    learner_model_param: {
      base_score: number[];  // stored in log-odds space in XGBoost 2.0+
      num_feature: string;
    };
  };
}

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-x));
}

/** Convert probability to log-odds (logit).
 *  XGBoost 3.x stores base_score in probability space in the native JSON,
 *  but tree leaf values are in log-odds space, so we must convert. */
function logit(p: number): number {
  return Math.log(p / (1.0 - p));
}

function scoreTree(tree: XGBoostTree, features: number[]): number {
  let nodeIdx = 0;

  while (true) {
    // A leaf node has left_children === -1
    if (tree.left_children[nodeIdx] === -1) {
      return tree.base_weights[nodeIdx];
    }

    const featureIdx = tree.split_indices[nodeIdx];
    const threshold = tree.split_conditions[nodeIdx];
    const featureVal = features[featureIdx] ?? 0;

    // Standard numeric split: go left if < threshold, else right
    if (featureVal < threshold) {
      nodeIdx = tree.left_children[nodeIdx];
    } else {
      nodeIdx = tree.right_children[nodeIdx];
    }
  }
}

let cachedModel: { trees: XGBoostTree[]; baseScore: number } | null = null;

export async function loadModel(): Promise<void> {
  if (cachedModel) return;

  const res = await fetch("/model/xgboost-model.json");
  const modelJson: XGBoostModelJSON = await res.json();

  // base_score in XGBoost 3.x native JSON is stored as a string like "[4.9295774E-1]"
  // (array bracket notation as a string). Strip brackets and parse.
  const baseScoreRaw = modelJson.learner.learner_model_param.base_score as unknown as string | number[];
  let baseScore: number;
  if (typeof baseScoreRaw === 'string') {
    // e.g. "[4.9295774E-1]"
    const cleaned = (baseScoreRaw as string).replace(/[\[\]]/g, '').trim();
    baseScore = parseFloat(cleaned);
  } else if (Array.isArray(baseScoreRaw)) {
    baseScore = (baseScoreRaw as number[])[0];
  } else {
    baseScore = parseFloat(String(baseScoreRaw));
  }

  const trees = modelJson.learner.gradient_booster.model.trees as XGBoostTree[];

  // base_score is stored in probability space; convert to log-odds for prediction
  cachedModel = { trees, baseScore: logit(baseScore) };
}

export function predict(features: number[]): number {
  if (!cachedModel) {
    throw new Error("Model not loaded. Call loadModel() first.");
  }

  let rawScore = cachedModel.baseScore;

  for (const tree of cachedModel.trees) {
    rawScore += scoreTree(tree, features);
  }

  // For binary:logistic: probability = sigmoid(base_score + sum_of_leaves)
  return sigmoid(rawScore);
}
