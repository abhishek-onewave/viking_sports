/**
 * types.ts — the Card Analyzer (Model V4) API contract, mirrored from
 * backend/model_service (model_manager_v4.py + schemas_v4.py).
 */

export type Recommendation = 'BUY' | 'DO NOT BUY' | 'REVIEW';
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface PlayerInfo {
  player: string;
  predictable_grade_identities: number;
}

/** One exact, predictable, qualifier-free card-grade identity. */
export interface CardIdentity {
  grade_uid: string;
  card_uid: string;
  player: string;
  year: number | null;
  set: string;
  card_number: string;
  parallel: string;
  grader: string;
  grade: string;
  display_name: string;
  historical_sales_count: number;
  prediction_available: boolean;
}

export interface HoldingPeriod {
  days: number;
  label: string;
  supported: boolean;
  note: string;
}

export interface AnalyzerMetadata {
  model_version: string;
  created_utc: string | null;
  latest_sale_date: string | null;
  forecast_week: string;
  forecast_week_end: string;
  current_date: string;
  is_stale: boolean;
  stale_message: string;
  supported_players: string[];
  holding_periods: HoldingPeriod[];
  assumptions: {
    forecast_horizon_days: number;
    required_annual_return: number;
    transaction_cost_rate: number;
    hurdle_after_transaction_costs: boolean;
    note: string;
  };
  performance: {
    buy_accuracy: number | null;
    buy_precision: number | null;
    buy_recall: number | null;
    buy_f1: number | null;
    buy_roc_auc: number | null;
    high_confidence_accuracy: number | null;
    high_confidence_coverage: number | null;
  };
}

export interface PredictV4Response {
  status: 'OK';
  model_version: string;
  grade_uid: string;
  matched_card: string;
  player: string;
  forecast_week: string;
  current_valuation: number;
  predicted_next_week_valuation: number;
  prediction_90pct_range: [number, number] | number[];
  expected_change_pct: number | null;
  historical_sales_used: number;
  active_sales_weeks_last_13: number;
  weeks_since_last_sale: number;
  data_confidence: DataConfidence;
  qualifiers_excluded: boolean;
  holding_period_days: number;
  /** Present only when a purchase amount was entered. */
  purchase_amount?: number;
  buy_probability?: number;
  maximum_recommended_purchase_price?: number;
  recommendation?: Recommendation;
}
