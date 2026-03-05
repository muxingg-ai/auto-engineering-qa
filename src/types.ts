// Query result from Python engine
export interface QueryResult {
  status: string;
  intent: string;
  nlu_mode?: string;
  dag_steps?: string[];
  // Cost comparison
  vehicle_1?: VehicleData;
  vehicle_2?: VehicleData;
  price_diff?: number;
  cost_diff?: number;
  breakdown_diff?: BreakdownDiff[];
  top_3_diff_modules?: BreakdownDiff[];
  // Cost breakdown
  vehicle?: VehicleData;
  breakdown_pct?: Record<string, number>;
  total_cost?: number;
  // Weight analysis
  results?: WeightResult[] | SensitivityResult[] | SupplierSwitchResult[];
  // Competitive strategy
  target_price?: number;
  benchmark?: VehicleData;
  weaknesses_to_exploit?: Weakness[];
  not_worth_improving?: NotWorth[];
  all_evs_by_price_distance?: VehicleData[];
  // Gigacasting top heavy
  top_3_heaviest?: GigacastingResult[];
  conclusion?: string;
  better_candidates?: VehicleData[];
  alternative_strategies?: AlternativeStrategy[];
  key_insight?: string;
  // Ranking
  metric?: string;
  ascending?: boolean;
  vehicles?: VehicleData[];
  top_3?: VehicleData[];
  // EV vs ICE
  ev_count?: number;
  ice_count?: number;
  ev_avg_margin?: number;
  ice_avg_margin?: number;
  margin_gap?: number;
  ev_avg_cost?: number;
  ice_avg_cost?: number;
  ev_cost_breakdown_avg?: Record<string, number>;
  ice_cost_breakdown_avg?: Record<string, number>;
  ev_vehicles?: VehicleData[];
  ice_vehicles?: VehicleData[];
  // Battery sensitivity
  price_change_pct?: number;
  top_beneficiary?: string;
  // Supplier
  catl?: SupplierGroup;
  lg_energy?: SupplierGroup;
  catl_advantage_pct?: number;
  // Filter
  constraints?: string[];
  result_count?: number;
  // Supplier context
  industry_context?: { catl_avg_efficiency: number; lg_avg_efficiency: number; catl_advantage_pct: number; note: string };
  // Simulation results (gigacasting etc.) - various result shapes
  simulation_results?: Array<{ name?: string; vehicle?: VehicleData; [key: string]: any }>;
  // Ranked results
  ranked?: Array<{ name: string; [key: string]: any }>;
  // General
  message?: string;
  question?: string;
}

export interface VehicleData {
  name: string;
  powertrain: string;
  body_type: string;
  is_concept: boolean;
  platform: string;
  manufacturing_process: string;
  range_km: number;
  weight_kg: number;
  battery_kwh?: number;
  cost_usd: number;
  price_usd: number;
  horsepower: number;
  production_volume_annual: number;
  margin_pct: number;
  range_efficiency_km_per_kwh?: number;
  cost_breakdown: Record<string, number>;
  competitive_position: CompetitivePosition;
  simulation_params: Record<string, number>;
  battery_supplier?: string;
  shares_platform_with?: string[];
  competes_with?: string[];
  key_advantage?: string;
}

export interface CompetitivePosition {
  segment?: string;
  price_band?: string;
  key_advantage?: string;
  key_weakness?: string;
  cost_gap_vs_segment_avg?: number;
  real_world_competitors?: string[];
  score?: number;
}

export interface BreakdownDiff {
  module: string;
  vehicle_1: number;
  vehicle_2: number;
  diff: number;
  diff_pct: number;
}

export interface WeightResult {
  vehicle: VehicleData;
  current_process: string;
  current_weight: number;
  scenarios: Scenario[];
}

export interface Scenario {
  name: string;
  weight_reduction_kg?: number;
  cost_change_usd: number;
  new_weight_kg?: number;
  breakeven_units?: number;
  annual_volume?: number;
  feasible?: boolean;
  note: string;
  efficiency_gain?: number;
  range_gain_km?: number;
}

export interface Weakness {
  dimension: string;
  current: string;
  target: string;
  improvement_cost_est: number;
  priority: string;
  note: string;
}

export interface NotWorth {
  dimension: string;
  current: string;
  reason: string;
}

export interface GigacastingResult {
  vehicle: VehicleData;
  current_weight: number;
  new_weight: number;
  weight_saved_kg: number;
  body_cost: number;
  cost_saved_usd: number;
  cost_saved_pct: number;
  breakeven_units: number;
  annual_volume: number;
  feasible: boolean;
  risk_level: string;
  volume_vs_breakeven: string;
}

export interface AlternativeStrategy {
  vehicle: string;
  current_supplier?: string;
  suggested: string;
  cost_delta: number;
  range_gain_km?: number;
  price_increase_potential?: number;
  note: string;
}

export interface SensitivityResult {
  vehicle: VehicleData;
  battery_cost: number;
  battery_pct_of_total: number;
  cost_change_usd: number;
  new_total_cost: number;
  old_margin_pct: number;
  new_margin_pct: number;
  margin_improvement_ppt: number;
}

export interface SupplierSwitchResult {
  vehicle: VehicleData;
  current_supplier: string;
  switch_to?: string;
  current_efficiency?: number;
  new_efficiency_est?: number;
  range_gain_km?: number;
  cost_delta_usd?: number;
  note: string;
}

export interface SupplierGroup {
  count: number;
  vehicles: string[];
  avg_efficiency: number;
  efficiencies: Record<string, number>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  queryResult?: QueryResult;
  timestamp: number;
}
