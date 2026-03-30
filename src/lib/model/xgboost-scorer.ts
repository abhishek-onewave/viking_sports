/* eslint-disable @typescript-eslint/no-explicit-any */

interface TreeNode {
  nodeid: number;
  depth?: number;
  split?: string;
  split_condition?: number;
  yes?: number;
  no?: number;
  missing?: number;
  leaf?: number;
  children?: TreeNode[];
}

interface XGBoostModelJSON {
  learner: {
    gradient_booster: {
      model: {
        trees: TreeNode[];
        tree_info: number[];
      };
    };
    learner_model_param: {
      base_score: string;
      num_feature: string;
    };
  };
}

function sigmoid(x: number): number {
  return 1.0 / (1.0 + Math.exp(-x));
}

function buildNodeMap(tree: TreeNode): Map<number, TreeNode> {
  const map = new Map<number, TreeNode>();
  const stack: TreeNode[] = [tree];
  while (stack.length > 0) {
    const node = stack.pop()!;
    map.set(node.nodeid, node);
    if (node.children) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }
  return map;
}

function scoreTree(nodeMap: Map<number, TreeNode>, features: number[]): number {
  let nodeId = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const node = nodeMap.get(nodeId);
    if (!node) return 0;

    if (node.leaf !== undefined) {
      return node.leaf;
    }

    const splitFeatureIdx = parseInt(node.split ?? "0", 10);
    const splitCondition = node.split_condition ?? 0;
    const featureValue = features[splitFeatureIdx] ?? 0;

    if (featureValue < splitCondition) {
      nodeId = node.yes ?? 0;
    } else {
      nodeId = node.no ?? 0;
    }
  }
}

let cachedModel: { trees: Map<number, TreeNode>[]; baseScore: number } | null =
  null;

export async function loadModel(): Promise<void> {
  if (cachedModel) return;

  const res = await fetch("/model/xgboost-model.json");
  const modelJson: XGBoostModelJSON = await res.json();

  const rawBaseScore = parseFloat(
    modelJson.learner.learner_model_param.base_score
  );

  const trees = modelJson.learner.gradient_booster.model.trees.map(
    (tree: any) => buildNodeMap(tree)
  );

  cachedModel = {
    trees,
    baseScore: rawBaseScore,
  };
}

export function predict(features: number[]): number {
  if (!cachedModel) {
    throw new Error("Model not loaded. Call loadModel() first.");
  }

  let rawScore = 0;
  for (const treeMap of cachedModel.trees) {
    rawScore += scoreTree(treeMap, features);
  }

  // For binary:logistic, base_score in JSON is already in logit space after XGBoost 2.0
  // but we still need to apply sigmoid to the sum of leaf values
  const probability = sigmoid(rawScore);
  return probability;
}
