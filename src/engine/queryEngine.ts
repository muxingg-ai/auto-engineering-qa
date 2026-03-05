/**
 * Query Engine - TypeScript port of query_engine.py
 * Deterministic NLU → Skill pipeline for automotive cost analysis
 */
import ontologyData from '../data/ontology.json';

// ─── Types ───────────────────────────────────────────────
export interface Vehicle {
  name: string;
  type?: string;
  powertrain?: string;
  body_style?: string;
  body_type?: string;
  platform?: string;
  manufacturing_process?: string;
  is_concept?: boolean;
  properties: Record<string, number>;
  cost_breakdown: Record<string, number>;
  relations?: Record<string, any>;
  competitive_position?: Record<string, any>;
  simulation_params?: Record<string, number>;
}

export interface OntologyData {
  vehicles: Vehicle[];
  suppliers: Array<{ id: string; name: string; [k: string]: any }>;
}

export interface IntentResult {
  intent: string;
  vehicles: string[];
  metric?: string;
  ascending?: boolean;
  body_filter?: string;
  powertrain_filter?: string;
  filters?: Array<{ field: string; op: string; value: number }>;
  confidence: number;
}

export interface HistoryEntry {
  role: 'user' | 'assistant';
  content: string;
  vehicles?: string[];
}

const data = ontologyData as OntologyData;

// ─── Helper Functions ───────────────────────────────────
function getVehicle(name: string): Vehicle | null {
  return data.vehicles.find(v => v.name.toLowerCase() === name.toLowerCase()) || null;
}

function getSupplier(supId: string) {
  return data.suppliers.find(s => s.id === supId) || null;
}

function calcMargin(v: Vehicle): number {
  const cost = v.properties.cost_usd;
  const price = v.properties.price_usd;
  return Math.round((price - cost) / price * 1000) / 10;
}

function calcRangeEfficiency(v: Vehicle): number | null {
  if (getPowertrain(v) !== 'EV') return null;
  const rng = v.properties.range_km;
  const bat = v.properties.battery_kwh || 0;
  if (bat === 0) return null;
  return Math.round(rng / bat * 100) / 100;
}

function getPowertrain(v: Vehicle): string {
  return v.powertrain || v.type || 'EV';
}

function getBodyType(v: Vehicle): string {
  return v.body_type || v.body_style || 'SUV';
}

function getRelations(v: Vehicle): Record<string, any> {
  const rel: Record<string, any> = { ...(v.relations || {}) };
  if (!rel.platform && v.platform) rel.platform = v.platform;
  if (!rel.manufacturing_process && v.manufacturing_process) rel.manufacturing_process = v.manufacturing_process;
  return rel;
}

function enrichVehicle(v: Vehicle): any {
  const rel = getRelations(v);
  const out: any = {
    name: v.name,
    powertrain: getPowertrain(v),
    body_type: getBodyType(v),
    is_concept: v.is_concept || false,
    platform: rel.platform || v.platform || '',
    manufacturing_process: rel.manufacturing_process || v.manufacturing_process || '',
  };
  Object.assign(out, v.properties);
  out.margin_pct = calcMargin(v);
  const eff = calcRangeEfficiency(v);
  if (eff !== null) out.range_efficiency_km_per_kwh = eff;
  out.cost_breakdown = v.cost_breakdown || {};
  out.competitive_position = v.competitive_position || {};
  out.simulation_params = v.simulation_params || {};

  const batSupId = rel.battery_supplier;
  if (batSupId) {
    const sup = getSupplier(batSupId);
    out.battery_supplier = sup ? sup.name : batSupId;
  }
  out.shares_platform_with = rel.shares_platform_with || [];
  out.competes_with = rel.competes_with || [];
  return out;
}

// ─── NLU ─────────────────────────────────────────────────
const VEHICLE_NAMES = [
  'Aurora_L', 'Falcon_X', 'Nebula_Pro', 'Orion_Max', 'Comet_E',
  'Tiger_GT', 'Swift_E', 'Electra_S', 'Volt_Mini', 'Urban_E',
  'Ranger_T', 'Desert_King', 'City_Gas', 'Family_Van', 'Mini_Gas',
];

const CONTEXT_REF_WORDS = [
  '刚才', '刚提到', '这些', '其中', '上面', '它们', '那几', '这几',
  '这三台', '这两台', '这三款', '这两款', '那三台', '那两台',
  '那三款', '那两款', '提到的', '上一个', '前面',
];

function extractVehicles(question: string): string[] {
  const found: string[] = [];
  const qLower = question.toLowerCase().replace(/-/g, '_').replace(/ /g, '');
  const qNoSep = qLower.replace(/_/g, '');
  for (const name of VEHICLE_NAMES) {
    const nameLower = name.toLowerCase();
    const nameNoSep = nameLower.replace(/_/g, '');
    if (qLower.includes(nameLower) || qNoSep.includes(nameNoSep)) {
      found.push(name);
    }
  }
  return found;
}

function hasContextReference(question: string): boolean {
  const q = question.toLowerCase();
  return CONTEXT_REF_WORDS.some(w => q.includes(w));
}

function resolveContextVehicles(history: HistoryEntry[]): string[] {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant' && history[i].vehicles?.length) {
      return history[i].vehicles!;
    }
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const found = extractVehicles(history[i].content);
    if (found.length > 0) return found;
  }
  return [];
}

export function classifyIntent(question: string, history: HistoryEntry[]): IntentResult {
  const q = question.toLowerCase();
  let vehicles = extractVehicles(question);

  // Context resolution
  if (!vehicles.length && hasContextReference(question) && history.length) {
    vehicles = resolveContextVehicles(history);
  }
  if (hasContextReference(question) && vehicles.length < 2 && history.length) {
    const ctxVehicles = resolveContextVehicles(history);
    if (ctxVehicles.length && !vehicles.length) {
      vehicles = ctxVehicles;
    } else if (ctxVehicles.length && vehicles.length) {
      for (const v of ctxVehicles) {
        if (!vehicles.includes(v)) vehicles.push(v);
      }
    }
  }

  // Gigacasting (highest priority)
  if (['一体化压铸', '压铸'].some(w => q.includes(w))) {
    if (q.includes('最重') || q.includes('重量最大'))
      return { intent: 'gigacasting_top_heavy', vehicles: [], confidence: 0.95 };
    if (vehicles.length)
      return { intent: 'gigacasting_sim', vehicles, confidence: 0.9 };
    return { intent: 'gigacasting_top_heavy', vehicles: [], confidence: 0.85 };
  }

  // Cost
  if (['成本', '价差', '售价差', '贵了', '差距', '分解', '分析价', '价格差'].some(w => q.includes(w))) {
    if (vehicles.length >= 2)
      return { intent: 'cost_comparison', vehicles: vehicles.slice(0, 2), confidence: 0.95 };
    if (vehicles.length === 1)
      return { intent: 'cost_breakdown', vehicles, confidence: 0.95 };
    if (['最高', '最大', '排'].some(w => q.includes(w)))
      return { intent: 'cost_ranking', vehicles: [], confidence: 0.9 };
  }

  // Weight analysis
  if (['工艺问题', '设计问题', '改进空间', '减重', '轻量'].some(w => q.includes(w)) && vehicles.length)
    return { intent: 'weight_analysis', vehicles, confidence: 0.9 };
  if ((q.includes('这么重') || (q.includes('重') && (q.includes('改进') || q.includes('问题')))) && vehicles.length)
    return { intent: 'weight_analysis', vehicles, confidence: 0.9 };

  // Competitive strategy
  if (['开发', '定价', '对标', '进入', '超越', '家用', '新势力'].some(w => q.includes(w)))
    return { intent: 'competitive_strategy', vehicles, confidence: 0.9 };

  // Supplier
  if (['供应商', '换成catl', '换catl', 'lg换', 'lg energy'].some(w => q.includes(w))) {
    if (vehicles.length)
      return { intent: 'supplier_switch', vehicles, confidence: 0.9 };
    return { intent: 'supplier_analysis', vehicles: [], confidence: 0.85 };
  }

  // Counterfactual
  if (q.includes('如果') && ['换成', '改用', '改为'].some(w => q.includes(w)) && vehicles.length)
    return { intent: 'gigacasting_sim', vehicles, confidence: 0.8 };

  // Vehicle listing
  const listingWords = ['哪些车', '哪些是', '哪几款', '有哪些', '列出', '列举', '分别是', '属于'];
  if (listingWords.some(w => q.includes(w)) && ['ev', 'ice', '纯电', '燃油', '油车', '电动'].some(w => q.includes(w)))
    return { intent: 'vehicle_listing', vehicles: [], confidence: 0.95 };

  // EV vs ICE
  if (('纯电' === q || q.includes('纯电') || q.includes('ev')) && (q.includes('燃油') || q.includes('ice') || q.includes('油车'))) {
    return { intent: 'ev_vs_ice', vehicles: [], confidence: 0.9 };
  }

  // Battery sensitivity
  if (q.includes('电池') && ['下降', '降', '涨', '变化'].some(w => q.includes(w)))
    return { intent: 'battery_sensitivity', vehicles, confidence: 0.9 };

  // Ranking
  if (['最高', '最低', '最大', '最小', '最重', '最轻', '最好', '最差', '排名', '排序', '哪款'].some(w => q.includes(w))) {
    let metric: string | undefined;
    if (q.includes('利润') || q.includes('毛利')) metric = 'margin';
    else if (q.includes('续航效率') || q.includes('km/kwh')) metric = 'range_efficiency';
    else if (q.includes('续航') || q.includes('里程')) metric = 'range_km';
    else if (q.includes('成本') && (q.includes('低') || q.includes('少'))) metric = 'cost_low';
    else if (q.includes('成本')) metric = 'cost_high';
    else if (q.includes('重')) metric = 'weight';
    else if (q.includes('产量')) metric = 'production';
    else if (q.includes('售价') || q.includes('价格')) metric = 'price';
    const ascending = ['最低', '最小', '最轻', '最少', '最便宜'].some(w => q.includes(w));
    return { intent: 'ranking', metric, ascending, vehicles, confidence: 0.85 };
  }

  // Filter
  if (['低于', '高于', '大于', '小于', '所有', '找'].some(w => q.includes(w)))
    return { intent: 'filter_query', vehicles, confidence: 0.8 };

  // Vehicle info
  if (vehicles.length)
    return { intent: 'vehicle_info', vehicles, confidence: 0.8 };

  // Context reference
  if (['刚才', '这些', '其中', '上面', '它们'].some(w => q.includes(w)))
    return { intent: 'context_reference', vehicles: [], confidence: 0.7 };

  return { intent: 'general', vehicles, confidence: 0.5 };
}

// ─── Skills ──────────────────────────────────────────────
function skillCostComparison(v1Name: string, v2Name: string) {
  const v1 = getVehicle(v1Name), v2 = getVehicle(v2Name);
  if (!v1 || !v2) return { status: 'error', message: `未找到车型: ${!v1 ? v1Name : v2Name}` };
  const e1 = enrichVehicle(v1), e2 = enrichVehicle(v2);
  const cb1 = v1.cost_breakdown || {}, cb2 = v2.cost_breakdown || {};
  const allKeys = [...new Set([...Object.keys(cb1), ...Object.keys(cb2)])].sort();
  const breakdownDiff = allKeys.map(k => {
    const val1 = cb1[k] || 0, val2 = cb2[k] || 0, diff = val2 - val1;
    return { module: k, vehicle_1: val1, vehicle_2: val2, diff, diff_pct: Math.round(diff / Math.max(val1, 1) * 1000) / 10 };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return {
    status: 'ok', intent: 'cost_comparison',
    vehicle_1: e1, vehicle_2: e2,
    price_diff: e2.price_usd - e1.price_usd,
    cost_diff: e2.cost_usd - e1.cost_usd,
    breakdown_diff: breakdownDiff,
    top_3_diff_modules: breakdownDiff.slice(0, 3),
    nlu_mode: 'rule',
    dag_steps: ['NLU意图识别', '成本分解引擎', '差异排序', '供应商关联分析', 'LLM深度洞察'],
  };
}

function skillCostBreakdown(vName: string) {
  const v = getVehicle(vName);
  if (!v) return { status: 'error', message: `未找到车型: ${vName}` };
  const enriched = enrichVehicle(v);
  const cb = v.cost_breakdown || {};
  const total = Object.values(cb).reduce((s, n) => s + n, 0);
  const breakdownPct: Record<string, number> = {};
  for (const [k, val] of Object.entries(cb)) breakdownPct[k] = Math.round(val / total * 1000) / 10;
  return {
    status: 'ok', intent: 'cost_breakdown', vehicle: enriched,
    breakdown_pct: breakdownPct, total_cost: total,
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '成本分解引擎', '百分比计算', '行业对标', 'LLM深度洞察'],
  };
}

function skillWeightAnalysis(vehicleNames: string[]) {
  const results: any[] = [];
  for (const name of vehicleNames) {
    const v = getVehicle(name);
    if (!v) continue;
    const e = enrichVehicle(v);
    const sim = v.simulation_params || {};
    const currentWeight = v.properties.weight_kg;
    const rel = getRelations(v);
    const process = rel.manufacturing_process;
    const scenarios: any[] = [];

    if (process === 'traditional_stamping') {
      const alDelta = sim.aluminum_body_weight_delta_pct || -0.08;
      const alCostDelta = sim.aluminum_body_cost_delta_pct || 0.08;
      const newWeight = Math.round(currentWeight * (1 + alDelta));
      const bodyCost = v.cost_breakdown.body_structure || 0;
      const costIncrease = Math.round(bodyCost * alCostDelta);
      scenarios.push({
        name: '换全铝密集工艺', weight_reduction_kg: currentWeight - newWeight,
        cost_change_usd: costIncrease, new_weight_kg: newWeight,
        note: `车身成本增加${costIncrease} USD，但减重${currentWeight - newWeight}kg`,
      });

      const gcWeightDelta = sim.gigacasting_weight_delta_pct || -0.10;
      const gcBreakeven = sim.gigacasting_tooling_amortize_units || 50000;
      const gcNewWeight = Math.round(currentWeight * (1 + gcWeightDelta));
      const chassisCost = v.cost_breakdown.chassis || 0;
      const totalCost = v.properties.cost_usd;
      const gcCostSave = Math.round(bodyCost * 0.30 + chassisCost * 0.10 + totalCost * 0.05);
      const annualVol = v.properties.production_volume_annual || 0;
      scenarios.push({
        name: '换一体化压铸', weight_reduction_kg: currentWeight - gcNewWeight,
        cost_change_usd: -gcCostSave, new_weight_kg: gcNewWeight,
        breakeven_units: gcBreakeven, annual_volume: annualVol,
        feasible: annualVol >= gcBreakeven,
        note: `减重${currentWeight - gcNewWeight}kg，省${gcCostSave} USD，但需年产${gcBreakeven}台回本（当前${annualVol}台）`,
      });
    }

    // Battery supplier switch
    const batSupId = rel.battery_supplier;
    if (batSupId === 'SUP002') {
      const effNow = calcRangeEfficiency(v) || 0;
      const effCatlAvg = 7.5;
      const rangeGain = Math.round((effCatlAvg - effNow) * (v.properties.battery_kwh || 0));
      scenarios.push({
        name: '换CATL电池方案', efficiency_gain: Math.round((effCatlAvg - effNow) * 100) / 100,
        range_gain_km: rangeGain, cost_change_usd: 2000,
        note: `续航效率从${effNow}提升到约${effCatlAvg}，续航增加约${rangeGain}km`,
      });
    }

    results.push({ vehicle: e, current_process: process, current_weight: currentWeight, scenarios });
  }
  return {
    status: 'ok', intent: 'weight_analysis', results,
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '重量数据提取', '工艺仿真计算', '供应商替代分析', 'LLM综合建议'],
  };
}

function skillCompetitiveStrategy(question: string) {
  const priceMatch = question.match(/(\d+\.?\d*)\s*万/);
  let targetPrice = priceMatch ? parseFloat(priceMatch[1]) * 10000 : 35000;
  if (!priceMatch) {
    const numMatch = question.match(/(\d{4,6})/);
    if (numMatch) targetPrice = parseFloat(numMatch[1]);
  }

  let bodyFilter: string | null = null;
  const qLower = question.toLowerCase();
  if (qLower.includes('suv')) bodyFilter = 'SUV';
  else if (qLower.includes('sedan') || qLower.includes('轿车')) bodyFilter = 'Sedan';
  else if (qLower.includes('mpv')) bodyFilter = 'MPV';

  let evs = data.vehicles.filter(v => getPowertrain(v) === 'EV' && !v.is_concept);
  if (bodyFilter) {
    const filtered = evs.filter(v => getBodyType(v) === bodyFilter);
    if (filtered.length) evs = filtered;
  }
  evs.sort((a, b) => Math.abs(a.properties.price_usd - targetPrice) - Math.abs(b.properties.price_usd - targetPrice));
  const benchmark = evs[0];
  const enrichedBenchmark = enrichVehicle(benchmark);

  const weaknesses: any[] = [];
  const eff = calcRangeEfficiency(benchmark);
  const allEffs = evs.map(v => calcRangeEfficiency(v)).filter((e): e is number => e !== null);
  const avgEff = allEffs.length ? allEffs.reduce((s, e) => s + e, 0) / allEffs.length : 7.0;

  if (eff && eff < avgEff) {
    weaknesses.push({
      dimension: '续航效率', current: `${eff} km/kWh`, target: `>${avgEff.toFixed(2)} km/kWh`,
      improvement_cost_est: 3000, priority: '高', note: '通过轻量化和电池优化可实现',
    });
  }

  const avgWeight = evs.reduce((s, v) => s + v.properties.weight_kg, 0) / evs.length;
  const bw = benchmark.properties.weight_kg;
  if (bw > avgWeight) {
    weaknesses.push({
      dimension: '整备质量', current: `${bw} kg`, target: `<${Math.round(avgWeight)} kg`,
      improvement_cost_est: 6000, priority: '高', note: '铝密集工艺减重200kg+，但需要模具投资',
    });
  }

  const batSup = (benchmark.relations || {}).battery_supplier;
  if (batSup === 'SUP002') {
    weaknesses.push({
      dimension: '电池供应商', current: 'LG Energy', target: 'CATL方案',
      improvement_cost_est: 2000, priority: '中', note: 'CATL续航效率高5.6%，同容量多跑约28km',
    });
  }

  const notWorth: any[] = [];
  const hp = benchmark.properties.horsepower;
  if (question.includes('家用') || question.includes('家庭')) {
    notWorth.push({ dimension: '最大功率', current: `${hp} hp`, reason: `${hp}hp对家庭用户已经够了，超越只是浪费成本` });
  }

  return {
    status: 'ok', intent: 'competitive_strategy', target_price: targetPrice,
    benchmark: enrichedBenchmark, weaknesses_to_exploit: weaknesses,
    not_worth_improving: notWorth,
    all_evs_by_price_distance: evs.slice(0, 5).map(enrichVehicle),
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '价格匹配引擎', '对标车型定位', '弱点分析引擎', '改进成本估算', 'LLM战略建议'],
  };
}

function skillGigacastingTopHeavy() {
  const productionVehicles = data.vehicles
    .filter(v => !v.is_concept && getPowertrain(v) === 'EV')
    .sort((a, b) => b.properties.weight_kg - a.properties.weight_kg);
  const top3 = productionVehicles.slice(0, 3);

  const results = top3.map(v => {
    const e = enrichVehicle(v);
    const sim = v.simulation_params || {};
    const weight = v.properties.weight_kg;
    const bodyCost = v.cost_breakdown.body_structure || 0;
    const totalCost = v.properties.cost_usd;
    const annualVol = v.properties.production_volume_annual || 0;
    const gcBreakeven = sim.gigacasting_tooling_amortize_units || 50000;
    const gcWeightDelta = sim.gigacasting_weight_delta_pct || -0.10;
    const newWeight = Math.round(weight * (1 + gcWeightDelta));
    const chassisCost = v.cost_breakdown.chassis || 0;
    const bodySave = Math.round(bodyCost * 0.30);
    const chassisSave = Math.round(chassisCost * 0.10);
    const assemblySave = Math.round(totalCost * 0.05);
    const costSaved = bodySave + chassisSave + assemblySave;
    const costSavedPct = Math.round(costSaved / totalCost * 1000) / 10;
    const feasible = annualVol >= gcBreakeven;
    let riskLevel: string;
    if (annualVol > 0 && annualVol < gcBreakeven) riskLevel = '极高——会亏损';
    else if (annualVol === gcBreakeven || (annualVol > 0 && annualVol <= gcBreakeven * 1.1)) riskLevel = '极高——刚好踩线';
    else if (annualVol > gcBreakeven * 1.5) riskLevel = '低';
    else riskLevel = '中';

    return {
      vehicle: e, current_weight: weight, new_weight: newWeight,
      weight_saved_kg: weight - newWeight, body_cost: bodyCost,
      cost_saved_usd: costSaved, cost_saved_pct: costSavedPct,
      breakeven_units: gcBreakeven, annual_volume: annualVol,
      feasible, risk_level: riskLevel,
      volume_vs_breakeven: gcBreakeven > 0 ? `${annualVol}/${gcBreakeven} = ${Math.round(annualVol / gcBreakeven * 100)}%` : 'N/A',
    };
  });

  const allEvs = data.vehicles.filter(v => getPowertrain(v) === 'EV' && !v.is_concept);
  const betterCandidates = allEvs
    .filter(v => {
      const vol = v.properties.production_volume_annual || 0;
      const be = (v.simulation_params || {}).gigacasting_tooling_amortize_units || 50000;
      return vol > be * 1.2 && !results.some(r => r.vehicle.name === v.name);
    })
    .map(enrichVehicle);

  const alternatives = top3
    .filter(v => (getRelations(v).battery_supplier) === 'SUP002')
    .map(v => {
      const eff = calcRangeEfficiency(v) || 0;
      return {
        vehicle: v.name, current_supplier: 'LG Energy', suggested: '换CATL方案',
        cost_delta: 2000, range_gain_km: Math.round((7.5 - eff) * (v.properties.battery_kwh || 0)),
        price_increase_potential: 5000, note: '成本增加约2000但续航提升，可提价5000',
      };
    });

  return {
    status: 'ok', intent: 'gigacasting_top_heavy', top_3_heaviest: results,
    conclusion: results.every(r => !r.feasible) ? '三台车都不推荐' : '部分可行',
    better_candidates: betterCandidates, alternative_strategies: alternatives,
    key_insight: '直觉告诉我们"最重的车换压铸收益最大"，但考虑产量因素后，这个选择可能亏损。',
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '重量排序引擎', '压铸仿真计算', '盈亏平衡分析', '替代方案搜索', 'LLM反直觉洞察'],
  };
}

function skillGigacastingSim(vehicleNames: string[]) {
  const results = vehicleNames.map(name => {
    const v = getVehicle(name);
    if (!v) return null;
    const e = enrichVehicle(v);
    const sim = v.simulation_params || {};
    const bodyCost = v.cost_breakdown.body_structure || 0;
    const totalCost = v.properties.cost_usd;
    const weight = v.properties.weight_kg;
    const annualVol = v.properties.production_volume_annual || 0;
    const gcBreakeven = sim.gigacasting_tooling_amortize_units || 50000;
    const gcCostPct = sim.gigacasting_cost_delta_pct || -0.15;
    const gcWeightPct = sim.gigacasting_weight_delta_pct || -0.10;
    const costSaved = Math.round(bodyCost * Math.abs(gcCostPct));
    const newWeight = Math.round(weight * (1 + gcWeightPct));
    return {
      vehicle: e, cost_saved_usd: costSaved,
      cost_saved_pct: Math.round(costSaved / totalCost * 1000) / 10,
      weight_saved_kg: weight - newWeight, new_weight: newWeight,
      breakeven_units: gcBreakeven, annual_volume: annualVol,
      feasible: annualVol >= gcBreakeven,
    };
  }).filter(Boolean);
  return { status: 'ok', intent: 'gigacasting_sim', results, nlu_mode: 'rule', dag_steps: ['NLU意图识别', '压铸仿真引擎', '盈亏平衡计算', 'LLM综合建议'] };
}

function skillSupplierSwitch(vehicleNames: string[]) {
  const results: any[] = [];
  for (const name of vehicleNames) {
    const v = getVehicle(name);
    if (!v) continue;
    const e = enrichVehicle(v);
    const rel = getRelations(v);
    const batSupId = rel.battery_supplier;
    const batSup = batSupId ? getSupplier(batSupId) : null;
    const eff = calcRangeEfficiency(v) || 0;
    if (batSup && batSup.name === 'LG Energy') {
      const rangeGain = Math.round((7.5 - eff) * (v.properties.battery_kwh || 0));
      results.push({
        vehicle: e, current_supplier: 'LG Energy', switch_to: 'CATL',
        current_efficiency: eff, new_efficiency_est: 7.5,
        range_gain_km: rangeGain, cost_delta_usd: 2000,
        note: `续航效率从${eff}提升到约7.5，续航增加约${rangeGain}km，成本增加约2000 USD`,
      });
    } else if (batSup && batSup.name === 'CATL') {
      results.push({ vehicle: e, current_supplier: 'CATL', note: '已使用CATL方案，续航效率已处于较优水平' });
    }
  }
  return {
    status: 'ok', intent: 'supplier_switch', results,
    industry_context: { catl_avg_efficiency: 7.51, lg_avg_efficiency: 7.11, catl_advantage_pct: 5.6, note: 'CATL方案平均续航效率7.51 km/kWh，比LG Energy的7.11高5.6%' },
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '供应商数据检索', '效率对比计算', '成本差异分析', 'LLM综合建议'],
  };
}

function skillRanking(metric: string, ascending: boolean, ptFilter?: string, bodyFilter?: string) {
  let vehicles = data.vehicles.filter(v => !v.is_concept);
  if (ptFilter) vehicles = vehicles.filter(v => getPowertrain(v) === ptFilter);
  if (bodyFilter) vehicles = vehicles.filter(v => getBodyType(v) === bodyFilter);

  const sortKey = (v: Vehicle): number => {
    if (metric === 'margin') return calcMargin(v);
    if (metric === 'range_efficiency') return calcRangeEfficiency(v) || 0;
    if (metric === 'range_km') return v.properties.range_km;
    if (metric === 'cost_low' || metric === 'cost_high') return v.properties.cost_usd;
    if (metric === 'weight') return v.properties.weight_kg;
    if (metric === 'production') return v.properties.production_volume_annual || 0;
    if (metric === 'price') return v.properties.price_usd;
    return 0;
  };

  if (metric === 'cost_low') ascending = true;
  else if (metric === 'cost_high') ascending = false;

  vehicles.sort((a, b) => ascending ? sortKey(a) - sortKey(b) : sortKey(b) - sortKey(a));
  const enriched = vehicles.map(enrichVehicle);

  const result: any = {
    status: 'ok', intent: 'ranking', metric, ascending,
    vehicles: enriched, top_3: enriched.slice(0, 3),
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '指标计算引擎', '排序引擎', 'LLM洞察生成'],
  };
  if (ptFilter) result.powertrain_filter = ptFilter;
  if (bodyFilter) result.body_filter = bodyFilter;
  return result;
}

function skillVehicleListing() {
  const evList = data.vehicles.filter(v => (v.type || v.powertrain) === 'EV');
  const iceList = data.vehicles.filter(v => (v.type || v.powertrain) === 'ICE');
  const mapVehicle = (v: Vehicle) => ({
    name: v.name, body_style: v.body_style || v.body_type || '',
    platform: v.platform || '', price: v.properties.price_usd, total_cost: v.properties.cost_usd,
  });
  return {
    intent: 'vehicle_listing', status: 'ok',
    ev_count: evList.length, ice_count: iceList.length, total: data.vehicles.length,
    ev_vehicles: evList.map(mapVehicle).sort((a, b) => b.price - a.price),
    ice_vehicles: iceList.map(mapVehicle).sort((a, b) => b.price - a.price),
    nlu_mode: 'rule', dag_steps: ['parse_query', 'filter_by_type', 'format_listing'],
  };
}

function skillEvVsIce() {
  const evs = data.vehicles.filter(v => getPowertrain(v) === 'EV' && !v.is_concept);
  const ices = data.vehicles.filter(v => getPowertrain(v) === 'ICE');
  const avg = (lst: Vehicle[], fn: (v: Vehicle) => number) => {
    const vals = lst.map(fn);
    return vals.length ? Math.round(vals.reduce((s, n) => s + n, 0) / vals.length * 10) / 10 : 0;
  };
  const evAvgMargin = avg(evs, calcMargin), iceAvgMargin = avg(ices, calcMargin);
  const evAvgCost = avg(evs, v => v.properties.cost_usd), iceAvgCost = avg(ices, v => v.properties.cost_usd);
  const keys = ['battery_pack', 'body_structure', 'powertrain', 'chassis', 'interior', 'electronics'];
  const evCbAvg: Record<string, number> = {}, iceCbAvg: Record<string, number> = {};
  for (const k of keys) {
    const evVals = evs.map(v => v.cost_breakdown[k] || 0);
    const iceVals = ices.map(v => v.cost_breakdown[k] || 0);
    evCbAvg[k] = evVals.length ? Math.round(evVals.reduce((s, n) => s + n, 0) / evVals.length) : 0;
    iceCbAvg[k] = iceVals.length ? Math.round(iceVals.reduce((s, n) => s + n, 0) / iceVals.length) : 0;
  }
  return {
    status: 'ok', intent: 'ev_vs_ice', ev_count: evs.length, ice_count: ices.length,
    ev_avg_margin: evAvgMargin, ice_avg_margin: iceAvgMargin,
    margin_gap: Math.round((iceAvgMargin - evAvgMargin) * 10) / 10,
    ev_avg_cost: evAvgCost, ice_avg_cost: iceAvgCost,
    ev_cost_breakdown_avg: evCbAvg, ice_cost_breakdown_avg: iceCbAvg,
    ev_vehicles: evs.map(enrichVehicle), ice_vehicles: ices.map(enrichVehicle),
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '分组统计引擎', '成本分解对比', '利润率分析', 'LLM行业洞察'],
  };
}

function skillBatterySensitivity(question: string) {
  const match = question.match(/(\d+)\s*%/);
  const pctChange = match ? -parseInt(match[1]) / 100 : -0.20;
  const evs = data.vehicles.filter(v => getPowertrain(v) === 'EV' && !v.is_concept);
  const results = evs.map(v => {
    const batCost = v.cost_breakdown.battery_pack || 0;
    const totalCost = v.properties.cost_usd;
    const price = v.properties.price_usd;
    const costChange = Math.round(batCost * pctChange);
    const newCost = totalCost + costChange;
    const oldMargin = calcMargin(v);
    const newMargin = Math.round((price - newCost) / price * 1000) / 10;
    return {
      vehicle: enrichVehicle(v), battery_cost: batCost,
      battery_pct_of_total: Math.round(batCost / totalCost * 1000) / 10,
      cost_change_usd: costChange, new_total_cost: newCost,
      old_margin_pct: oldMargin, new_margin_pct: newMargin,
      margin_improvement_ppt: Math.round((newMargin - oldMargin) * 10) / 10,
    };
  }).sort((a, b) => Math.abs(b.cost_change_usd) - Math.abs(a.cost_change_usd));
  return {
    status: 'ok', intent: 'battery_sensitivity', price_change_pct: pctChange, results,
    top_beneficiary: results[0]?.vehicle.name || null,
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '电池成本提取', '敏感度仿真', '利润率重算', '排序', 'LLM分析'],
  };
}

function skillFilter(question: string) {
  let filtered = data.vehicles.filter(v => getPowertrain(v) === 'EV' && !v.is_concept);
  const constraints: string[] = [];
  const costMatch = question.match(/成本.*?[低小]于\s*(\d+)/);
  if (costMatch) { const t = parseInt(costMatch[1]); filtered = filtered.filter(v => v.properties.cost_usd < t); constraints.push(`成本 < ${t}`); }
  const effMatch = question.match(/效率.*?[高大]于\s*(\d+\.?\d*)/);
  if (effMatch) { const t = parseFloat(effMatch[1]); filtered = filtered.filter(v => (calcRangeEfficiency(v) || 0) > t); constraints.push(`续航效率 > ${t}`); }
  const rangeMatch = question.match(/续航.*?[高大]于\s*(\d+)/);
  if (rangeMatch) { const t = parseInt(rangeMatch[1]); filtered = filtered.filter(v => v.properties.range_km > t); constraints.push(`续航 > ${t}`); }
  if (question.includes('利润') || question.includes('毛利')) filtered.sort((a, b) => calcMargin(b) - calcMargin(a));
  return {
    status: 'ok', intent: 'filter_query', constraints, result_count: filtered.length,
    vehicles: filtered.map(enrichVehicle), nlu_mode: 'rule', dag_steps: ['NLU意图识别', '多条件过滤引擎', '排序引擎', 'LLM推荐分析'],
  };
}

function skillVehicleInfo(vehicleNames: string[]) {
  const results = vehicleNames.map(n => getVehicle(n)).filter((v): v is Vehicle => v !== null).map(enrichVehicle);
  return { status: 'ok', intent: 'vehicle_info', vehicles: results, nlu_mode: 'rule', dag_steps: ['NLU意图识别', '车型数据提取', 'LLM信息整合'] };
}

function skillSupplierAnalysis() {
  const catlVehicles: Vehicle[] = [], lgVehicles: Vehicle[] = [];
  for (const v of data.vehicles) {
    if (getPowertrain(v) !== 'EV') continue;
    const bs = getRelations(v).battery_supplier;
    if (bs === 'SUP001') catlVehicles.push(v);
    else if (bs === 'SUP002') lgVehicles.push(v);
  }
  const catlEffs = catlVehicles.map(v => calcRangeEfficiency(v)).filter((e): e is number => e !== null);
  const lgEffs = lgVehicles.map(v => calcRangeEfficiency(v)).filter((e): e is number => e !== null);
  const catlAvg = catlEffs.length ? Math.round(catlEffs.reduce((s, n) => s + n, 0) / catlEffs.length * 100) / 100 : 0;
  const lgAvg = lgEffs.length ? Math.round(lgEffs.reduce((s, n) => s + n, 0) / lgEffs.length * 100) / 100 : 0;
  return {
    status: 'ok', intent: 'supplier_analysis',
    catl: { count: catlVehicles.length, vehicles: catlVehicles.map(v => v.name), avg_efficiency: catlAvg, efficiencies: Object.fromEntries(catlVehicles.map(v => [v.name, calcRangeEfficiency(v)])) },
    lg_energy: { count: lgVehicles.length, vehicles: lgVehicles.map(v => v.name), avg_efficiency: lgAvg, efficiencies: Object.fromEntries(lgVehicles.map(v => [v.name, calcRangeEfficiency(v)])) },
    catl_advantage_pct: lgAvg ? Math.round((catlAvg - lgAvg) / lgAvg * 1000) / 10 : 0,
    nlu_mode: 'rule', dag_steps: ['NLU意图识别', '供应商关系提取', '效率统计引擎', 'LLM对比分析'],
  };
}

function applyNumericFilters(vehicles: Vehicle[], filters: Array<{ field: string; op: string; value: number }>) {
  const ops: Record<string, (a: number, b: number) => boolean> = {
    '<': (a, b) => a < b, '>': (a, b) => a > b, '<=': (a, b) => a <= b, '>=': (a, b) => a >= b, '==': (a, b) => a === b,
  };
  let result = vehicles;
  for (const f of filters) {
    const opFn = ops[f.op];
    if (!opFn) continue;
    result = result.filter(v => {
      let val: number | null;
      if (f.field === 'range_efficiency') val = calcRangeEfficiency(v);
      else if (f.field === 'margin_pct') val = calcMargin(v);
      else val = v.properties[f.field] ?? null;
      return val !== null && opFn(val, f.value);
    });
  }
  return result;
}

// ─── Main Process ────────────────────────────────────────
export function process(question: string, history: HistoryEntry[] = [], llmIntent?: IntentResult): any {
  const intentResult = llmIntent || classifyIntent(question, history);
  const nluMode = llmIntent ? 'llm' : 'rule';
  const intent = intentResult.intent;
  const vehicles = intentResult.vehicles || [];

  let result: any = null;

  if (intent === 'cost_comparison' && vehicles.length >= 2) {
    result = skillCostComparison(vehicles[0], vehicles[1]);
  } else if (intent === 'cost_breakdown' && vehicles.length) {
    if (vehicles.length === 1) {
      result = skillCostBreakdown(vehicles[0]);
    } else {
      const breakdowns = vehicles.map(vn => {
        const r = skillCostBreakdown(vn);
        return r.status === 'ok' ? { vehicle: r.vehicle, breakdown_pct: r.breakdown_pct, total_cost: r.total_cost } : null;
      }).filter(Boolean);
      result = { status: 'ok', intent: 'cost_breakdown_multi', vehicles: breakdowns, count: breakdowns.length, nlu_mode: nluMode, dag_steps: ['NLU意图识别', '多车成本分解引擎', '百分比计算', 'LLM对比分析'] };
    }
  } else if (intent === 'cost_ranking') {
    result = skillRanking('cost_high', false);
  } else if (intent === 'weight_analysis' && vehicles.length) {
    result = skillWeightAnalysis(vehicles);
  } else if (intent === 'competitive_strategy') {
    result = skillCompetitiveStrategy(question);
  } else if (intent === 'gigacasting_top_heavy') {
    result = skillGigacastingTopHeavy();
  } else if (intent === 'gigacasting_sim' && vehicles.length) {
    result = skillGigacastingSim(vehicles);
  } else if (intent === 'supplier_switch' && vehicles.length) {
    result = skillSupplierSwitch(vehicles);
  } else if (intent === 'supplier_analysis') {
    result = skillSupplierAnalysis();
  } else if (intent === 'ranking') {
    const rawMetric = intentResult.metric || 'margin';
    const metricMap: Record<string, string> = {
      margin_pct: 'margin', margin: 'margin', range_efficiency: 'range_efficiency',
      range_efficiency_km_per_kwh: 'range_efficiency', range_km: 'range_km', range: 'range_km',
      cost_usd: 'cost_low', cost: 'cost_low', price_usd: 'price', price: 'price',
      weight_kg: 'weight', weight: 'weight', production_volume_annual: 'production', production: 'production',
    };
    const metric = metricMap[rawMetric] || rawMetric;
    const ascending = intentResult.ascending || false;
    let pt = intentResult.powertrain_filter;
    if (!pt) {
      if (question.toLowerCase().includes('ev') || question.includes('纯电')) pt = 'EV';
      else if (question.toLowerCase().includes('ice') || question.includes('燃油')) pt = 'ICE';
    }
    let bf = intentResult.body_filter;
    if (!bf) {
      const ql = question.toLowerCase();
      if (ql.includes('suv')) bf = 'SUV';
      else if (ql.includes('sedan') || ql.includes('轿车')) bf = 'Sedan';
      else if (ql.includes('mpv')) bf = 'MPV';
      else if (ql.includes('hatchback') || ql.includes('两厢') || ql.includes('掀背')) bf = 'Hatchback';
    }
    result = skillRanking(metric, ascending, pt, bf);

    const nluFilters = intentResult.filters || [];
    if (nluFilters.length && result.vehicles) {
      let allVehicles = data.vehicles.filter(v => !v.is_concept);
      if (pt) allVehicles = allVehicles.filter(v => getPowertrain(v) === pt);
      if (bf) allVehicles = allVehicles.filter(v => getBodyType(v) === bf);
      const filteredRaw = applyNumericFilters(allVehicles, nluFilters);
      const filteredNames = new Set(filteredRaw.map(v => v.name));
      result.vehicles = result.vehicles.filter((v: any) => filteredNames.has(v.name));
      result.top_3 = result.vehicles.slice(0, 3);
      result.filters_applied = nluFilters.map((f: any) => `${f.field} ${f.op} ${f.value}`);
      result.filtered_count = result.vehicles.length;
    }
  } else if (intent === 'vehicle_listing') {
    result = skillVehicleListing();
  } else if (intent === 'ev_vs_ice') {
    result = skillEvVsIce();
  } else if (intent === 'battery_sensitivity') {
    result = skillBatterySensitivity(question);
  } else if (intent === 'filter_query') {
    result = skillFilter(question);
    const nluFilters = intentResult.filters || [];
    if (nluFilters.length && result.vehicles) {
      const allRaw = data.vehicles.filter(v => getPowertrain(v) === 'EV' && !v.is_concept);
      const filteredRaw = applyNumericFilters(allRaw, nluFilters);
      const filteredNames = new Set(filteredRaw.map(v => v.name));
      result.vehicles = result.vehicles.filter((v: any) => filteredNames.has(v.name));
      if (!result.vehicles.length && filteredRaw.length) result.vehicles = filteredRaw.map(enrichVehicle);
      result.result_count = result.vehicles.length;
      result.filters_applied = nluFilters.map((f: any) => `${f.field} ${f.op} ${f.value}`);
    }
  } else if (intent === 'vehicle_info' && vehicles.length) {
    result = skillVehicleInfo(vehicles);
  } else {
    const allEnriched = data.vehicles.map(enrichVehicle);
    result = { status: 'ok', intent: 'general', message: '问题已理解，但需要LLM进行深度分析', vehicles: allEnriched, question, nlu_mode: nluMode, dag_steps: ['NLU意图识别', '全量数据加载', 'LLM深度分析'] };
  }

  if (result) result.nlu_mode = nluMode;
  return result;
}
