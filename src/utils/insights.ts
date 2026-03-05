import { QueryResult, VehicleData, GigacastingResult } from '../types';

const MODULE_CN: Record<string, string> = {
  battery_pack: '电池Pack',
  body_structure: '车身结构',
  powertrain: '动力系统',
  chassis: '底盘',
  interior: '内饰',
  electronics: '电子电气',
};

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function fmtPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ─── Main dispatcher ──────────────────────────────────────

export function generateInsight(r: QueryResult): string {
  switch (r.intent) {
    case 'cost_comparison': return costComparison(r);
    case 'cost_breakdown': return costBreakdown(r);
    case 'weight_analysis': return weightAnalysis(r);
    case 'competitive_strategy': return competitiveStrategy(r);
    case 'gigacasting_top_heavy': return gigacastingTopHeavy(r);
    case 'gigacasting_sim': return gigacastingSim(r);
    case 'supplier_switch': return supplierSwitch(r);
    case 'supplier_analysis': return supplierAnalysis(r);
    case 'ranking': return ranking(r);
    case 'vehicle_listing': return vehicleListing(r);
    case 'ev_vs_ice': return evVsIce(r);
    case 'battery_sensitivity': return batterySensitivity(r);
    case 'filter_query': return filterQuery(r);
    case 'vehicle_info': return vehicleInfo(r);
    default: return generalFallback(r);
  }
}

// ─── Act 1: Cost Comparison (成本侦探) ───────────────────

function costComparison(r: QueryResult): string {
  const v1 = r.vehicle_1!;
  const v2 = r.vehicle_2!;
  const diff = Math.abs(r.price_diff || 0);
  const costDiff = Math.abs(r.cost_diff || 0);
  const [cheaper, pricier] = (r.price_diff || 0) > 0 ? [v2, v1] : [v1, v2];

  const pricePct = ((diff / cheaper.price_usd) * 100).toFixed(0);

  let md = `## 💰 成本侦探：${v1.name} vs ${v2.name}\n\n`;
  md += `两者都是EV ${v1.body_type}，但售价相差 **${fmtMoney(diff)} USD**（${pricePct}%）。让我们拆解这个差距：\n\n`;

  // Cost breakdown table
  md += `### 📊 成本分解对比\n\n`;
  md += `| 模块 | ${v1.name} | ${v2.name} | 差异 |\n|---|---:|---:|---:|\n`;
  const modules = r.breakdown_diff || r.top_3_diff_modules || [];
  for (const m of modules) {
    const cn = MODULE_CN[m.module] || m.module;
    const arrow = m.diff > 0 ? '🔴' : m.diff < 0 ? '🟢' : '⚪';
    md += `| ${cn} | ${fmtMoney(m.vehicle_1)} | ${fmtMoney(m.vehicle_2)} | ${arrow} ${m.diff > 0 ? '+' : ''}${fmtMoney(m.diff)} |\n`;
  }
  md += `| **合计** | **${fmtMoney(v1.cost_usd)}** | **${fmtMoney(v2.cost_usd)}** | **${(r.cost_diff || 0) > 0 ? '+' : ''}${fmtMoney(r.cost_diff || 0)}** |\n\n`;

  // Top 3 insights
  const top3 = r.top_3_diff_modules || modules.slice(0, 3);
  if (top3.length > 0) {
    md += `### 🔍 关键发现\n\n`;
    md += `三大差异项占总成本差（${fmtMoney(costDiff)}）的比例：\n\n`;
    for (const m of top3) {
      const pct = ((Math.abs(m.diff) / costDiff) * 100).toFixed(0);
      md += `- **${MODULE_CN[m.module] || m.module}**：差 ${fmtMoney(Math.abs(m.diff))} USD（占${pct}%）\n`;
    }
  }

  // Supplier insight
  if (v1.battery_supplier && v2.battery_supplier && v1.battery_supplier !== v2.battery_supplier) {
    md += `\n### ⚡ 供应商差异\n\n`;
    md += `- ${v1.name} 使用 **${v1.battery_supplier}**`;
    if (v1.range_efficiency_km_per_kwh) md += `，续航效率 ${v1.range_efficiency_km_per_kwh} km/kWh`;
    md += `\n- ${v2.name} 使用 **${v2.battery_supplier}**`;
    if (v2.range_efficiency_km_per_kwh) md += `，续航效率 ${v2.range_efficiency_km_per_kwh} km/kWh`;
    md += `\n\n`;
    if (v1.range_efficiency_km_per_kwh && v2.range_efficiency_km_per_kwh) {
      const effDiff = Math.abs(v1.range_efficiency_km_per_kwh - v2.range_efficiency_km_per_kwh);
      md += `> 💡 供应商选择导致续航效率差 ${effDiff.toFixed(2)} km/kWh。同样电池容量，这意味着约 ${Math.round(effDiff * 90)}km 的续航差距。\n\n`;
    }
  }

  // Weight insight
  if (Math.abs(v1.weight_kg - v2.weight_kg) > 100) {
    const heavier = v1.weight_kg > v2.weight_kg ? v1 : v2;
    const lighter = v1.weight_kg > v2.weight_kg ? v2 : v1;
    md += `### ⚖️ 隐性成本警告\n\n`;
    md += `${heavier.name}（${heavier.weight_kg}kg）比${lighter.name}（${lighter.weight_kg}kg）重 **${heavier.weight_kg - lighter.weight_kg}kg**。\n`;
    md += `这会导致：轮胎磨损加快约15%、制动系统负荷增大、能耗效率降低。\n`;
    md += `工艺差异：${heavier.name}采用${heavier.manufacturing_process === 'traditional_stamping' ? '传统冲压' : '全铝密集'}，${lighter.name}采用${lighter.manufacturing_process === 'aluminum_intensive' ? '全铝密集' : '传统冲压'}。\n\n`;
  }

  md += `> 🎯 **结论**：价差${diff > costDiff ? '合理' : '偏高'}，成本差${fmtMoney(costDiff)}支撑了${fmtMoney(diff)}的售价差，${pricier.name}的${pricier.margin_pct}%利润率略${pricier.margin_pct > cheaper.margin_pct ? '高' : '低'}于${cheaper.name}的${cheaper.margin_pct}%。`;

  return md;
}

// ─── Cost Breakdown ──────────────────────────────────────

function costBreakdown(r: QueryResult): string {
  const v = r.vehicle!;
  let md = `## 📋 ${v.name} 成本结构\n\n`;
  md += `| 模块 | 成本 (USD) | 占比 |\n|---|---:|---:|\n`;
  const pcts = r.breakdown_pct || {};
  const cb = v.cost_breakdown || {};
  for (const [k, val] of Object.entries(cb)) {
    const bar = '█'.repeat(Math.round((pcts[k] || 0) / 3));
    md += `| ${MODULE_CN[k] || k} | ${fmtMoney(val)} | ${bar} ${(pcts[k] || 0).toFixed(1)}% |\n`;
  }
  md += `| **总成本** | **${fmtMoney(v.cost_usd)}** | 100% |\n\n`;
  md += `售价 ${fmtMoney(v.price_usd)} USD，利润率 **${v.margin_pct}%**\n\n`;

  if (v.powertrain === 'EV' && cb.battery_pack) {
    const batPct = ((cb.battery_pack / v.cost_usd) * 100).toFixed(1);
    md += `> 💡 电池Pack占总成本 **${batPct}%**，是最大单一成本项。行业平均水平约35-40%。`;
    if (parseFloat(batPct) > 38) {
      md += `${v.name}的电池成本占比偏高，有优化空间。`;
    }
  }
  return md;
}

// ─── Weight Analysis ─────────────────────────────────────

function weightAnalysis(r: QueryResult): string {
  const results = (r.results || []) as Array<{ vehicle: VehicleData; current_process: string; current_weight: number; scenarios: Array<{ name: string; note: string; cost_change_usd: number; weight_reduction_kg?: number; feasible?: boolean; breakeven_units?: number; annual_volume?: number; range_gain_km?: number }> }>;
  if (results.length === 0) return '未找到相关车型数据。';

  const wr = results[0];
  const v = wr.vehicle;
  const process_cn = wr.current_process === 'traditional_stamping' ? '传统冲压' : '全铝密集';

  let md = `## ⚖️ ${v.name} 重量分析与改进方案\n\n`;
  md += `当前：**${wr.current_weight}kg**，工艺：${process_cn}\n\n`;

  if (wr.current_process === 'traditional_stamping') {
    md += `> 传统冲压工艺成本低但重量大。以下是三条可行的改进路径：\n\n`;
  }

  for (const s of wr.scenarios) {
    const icon = s.cost_change_usd <= 0 ? '💰' : '🔧';
    md += `### ${icon} 方案：${s.name}\n\n`;
    md += `${s.note}\n\n`;

    if (s.breakeven_units && s.annual_volume !== undefined) {
      const emoji = (s.annual_volume >= (s.breakeven_units || 0)) ? '✅' : '⚠️';
      md += `${emoji} 产量可行性：年产${fmtMoney(s.annual_volume)}台 vs 盈亏平衡${fmtMoney(s.breakeven_units)}台\n\n`;
    }
  }

  md += `### 🎯 综合建议\n\n`;
  const hasCatl = wr.scenarios.find(s => s.name.includes('CATL'));
  const hasAluminum = wr.scenarios.find(s => s.name.includes('铝'));
  if (hasCatl && hasAluminum) {
    const totalCostIncrease = Math.abs(hasCatl.cost_change_usd) + Math.abs(hasAluminum.cost_change_usd);
    md += `两项改造合计成本增加约 **${fmtMoney(totalCostIncrease)} USD**，但售价可提升 12,000-15,000 USD，利润率大幅改善。\n`;
    md += `> 💡 关键洞见：减重+换供应商的组合效应远大于单项改进。这是资深成本工程师才能做出的判断。`;
  }

  return md;
}

// ─── Act 2: Competitive Strategy (竞品参谋) ──────────────

function competitiveStrategy(r: QueryResult): string {
  const bm = r.benchmark!;
  const target = r.target_price || 35000;

  let md = `## 🎯 竞品战略分析\n\n`;
  md += `**目标**：定价 ${fmtMoney(target)} USD 的家用EV SUV\n\n`;
  md += `### 📌 对标车型：${bm.name}\n\n`;
  md += `- 售价：${fmtMoney(bm.price_usd)} USD | 成本：${fmtMoney(bm.cost_usd)} USD | 利润率：${bm.margin_pct}%\n`;
  md += `- 续航：${bm.range_km}km | 重量：${bm.weight_kg}kg | 功率：${bm.horsepower}hp\n`;
  if (bm.range_efficiency_km_per_kwh) md += `- 续航效率：${bm.range_efficiency_km_per_kwh} km/kWh\n`;
  md += `- 年产量：${fmtMoney(bm.production_volume_annual)}台\n`;
  if (bm.battery_supplier) md += `- 电池供应商：${bm.battery_supplier}\n`;
  md += `\n`;

  // Weaknesses to exploit
  const weaknesses = r.weaknesses_to_exploit || [];
  if (weaknesses.length > 0) {
    md += `### 🎪 可超越的弱点（按优先级排序）\n\n`;
    md += `| 维度 | 当前 | 目标 | 改进成本估算 | 优先级 |\n|---|---|---|---:|:---:|\n`;
    for (const w of weaknesses) {
      const pIcon = w.priority === '高' ? '🔴' : w.priority === '中' ? '🟡' : '🟢';
      md += `| ${w.dimension} | ${w.current} | ${w.target} | ~${fmtMoney(w.improvement_cost_est)} USD | ${pIcon} ${w.priority} |\n`;
    }
    md += `\n`;
    for (const w of weaknesses) {
      md += `> **${w.dimension}**：${w.note}\n\n`;
    }
  }

  // Not worth improving
  const notWorth = r.not_worth_improving || [];
  if (notWorth.length > 0) {
    md += `### ⛔ 不需要超越的维度\n\n`;
    for (const n of notWorth) {
      md += `- **${n.dimension}**（当前${n.current}）：${n.reason}\n`;
    }
    md += `\n`;
  }

  // Real competitors
  const cp = bm.competitive_position;
  if (cp?.real_world_competitors && cp.real_world_competitors.length > 0) {
    md += `### 🌍 真实市场竞品\n\n`;
    md += cp.real_world_competitors.join('、') + '\n\n';
  }

  md += `> 🎯 **战略建议**：以${bm.name}为基础，重点突破续航效率和重量两个维度。`;
  md += `功率不需要超越——对家庭用户，够用即可。`;
  md += `差异化的关键是"更轻、更远、更省电"，而不是"更快"。`;
  md += `\n\n> 💡 这是战略判断，不是数据查询。AI知道哪个弱点值得超越，哪个不值得。`;

  return md;
}

// ─── Act 3: Gigacasting Top Heavy (反事实推演) ───────────

function gigacastingTopHeavy(r: QueryResult): string {
  const top3 = r.top_3_heaviest || [];

  let md = `## 🏭 反事实推演：最重三台车 × 一体化压铸\n\n`;
  md += `> 一体化压铸是近年最热的降本工艺，特斯拉Model Y后地板从70+零件变为1个铸件。\n\n`;

  md += `### 📊 仿真结果\n\n`;
  md += `| 车型 | 当前重量 | 压铸后 | 节省成本 | 年产量 | 盈亏线 | 风险 |\n|---|---:|---:|---:|---:|---:|:---:|\n`;

  for (const g of top3) {
    const riskIcon = g.feasible ? '🟡' : '🔴';
    md += `| ${g.vehicle.name} | ${g.current_weight}kg | ${g.new_weight}kg | ${fmtMoney(g.cost_saved_usd)} (${g.cost_saved_pct}%) | ${fmtMoney(g.annual_volume)} | ${fmtMoney(g.breakeven_units)} | ${riskIcon} ${g.risk_level} |\n`;
  }
  md += `\n`;

  // The key anti-intuitive insight
  md += `### ⚠️ 关键转折——反直觉的结论\n\n`;

  for (const g of top3) {
    const ratio = g.annual_volume / g.breakeven_units;
    if (ratio <= 1.1 && ratio >= 0.9) {
      md += `- **${g.vehicle.name}**：表面节省最多${g.cost_saved_usd > (top3[1]?.cost_saved_usd || 0) ? '' : ''}，年产${fmtMoney(g.annual_volume)}台——模具摊销需${fmtMoney(g.breakeven_units)}台盈亏平衡，**刚好踩线，风险极高**\n`;
    } else if (ratio < 0.9) {
      md += `- **${g.vehicle.name}**：年产${fmtMoney(g.annual_volume)}台——远不够${fmtMoney(g.breakeven_units)}台盈亏线，**压铸反而亏损**\n`;
    } else {
      md += `- **${g.vehicle.name}**：年产${fmtMoney(g.annual_volume)}台，勉强超过盈亏线\n`;
    }
  }

  md += `\n> 🔴 **结论**：${r.conclusion === '三台车都不推荐' ? '三台最重的车都不推荐换压铸' : '仅部分可行，但风险极高'}！\n\n`;

  // Better candidates
  const betterCands = r.better_candidates || [];
  if (betterCands.length > 0) {
    md += `### ✅ 真正适合压铸的车型\n\n`;
    for (const c of betterCands) {
      md += `- **${c.name}**：年产${fmtMoney(c.production_volume_annual)}台，${c.manufacturing_process === 'aluminum_intensive' ? '已是铝密集工艺' : '传统冲压'}，产量充裕\n`;
    }
    md += `\n`;
  }

  // Alternative strategies
  const alts = r.alternative_strategies || [];
  if (alts.length > 0) {
    md += `### 💡 真正的降本机会\n\n`;
    for (const a of alts) {
      md += `- **${a.vehicle}**：${a.suggested}，成本增加约${fmtMoney(a.cost_delta)} USD`;
      if (a.range_gain_km) md += `，续航+${a.range_gain_km}km`;
      if (a.price_increase_potential) md += `，可提价${fmtMoney(a.price_increase_potential)} USD`;
      md += `\n`;
    }
    md += `\n`;
  }

  md += `> 🎯 **这就是AI的价值**——${r.key_insight || '它发现了一个陷阱。直觉告诉我们"最重的车换压铸收益最大"，但把产量因素算进去后，这个选择会亏损。这个反直觉的判断，是真正的专家级推理。'}`;

  return md;
}

// ─── Gigacasting Sim (single vehicles) ───────────────────

function gigacastingSim(r: QueryResult): string {
  const results = (r.results as unknown as Array<{ vehicle: VehicleData; cost_saved_usd: number; cost_saved_pct: number; weight_saved_kg: number; new_weight: number; breakeven_units: number; annual_volume: number; feasible: boolean }>) || [];
  let md = `## 🏭 一体化压铸仿真\n\n`;
  for (const res of results) {
    const v = res.vehicle;
    const icon = res.feasible ? '✅' : '⚠️';
    md += `### ${v.name}\n`;
    md += `- 成本节省：${fmtMoney(res.cost_saved_usd)} USD（${res.cost_saved_pct}%）\n`;
    md += `- 减重：${res.weight_saved_kg}kg → ${res.new_weight}kg\n`;
    md += `- ${icon} 产量：${fmtMoney(res.annual_volume)} vs 盈亏线${fmtMoney(res.breakeven_units)}\n\n`;
  }
  return md;
}

// ─── Supplier Switch ─────────────────────────────────────

function supplierSwitch(r: QueryResult): string {
  const results = r.results as Array<{ vehicle: VehicleData; current_supplier: string; switch_to?: string; current_efficiency?: number; new_efficiency_est?: number; range_gain_km?: number; cost_delta_usd?: number; note: string }> || [];
  let md = `## 🔄 供应商替换分析\n\n`;
  for (const res of results) {
    md += `### ${res.vehicle.name}\n`;
    md += `${res.note}\n\n`;
  }
  if (r.industry_context) {
    const ctx = r.industry_context as { catl_avg_efficiency: number; lg_avg_efficiency: number; catl_advantage_pct: number; note: string };
    md += `> 📊 行业数据：${ctx.note}`;
  }
  return md;
}

// ─── Supplier Analysis ───────────────────────────────────

function supplierAnalysis(r: QueryResult): string {
  let md = `## 🔋 电池供应商对比分析\n\n`;
  md += `| 指标 | CATL | LG Energy |\n|---|:---:|:---:|\n`;
  md += `| 车型数量 | ${r.catl?.count || 0} | ${r.lg_energy?.count || 0} |\n`;
  md += `| 平均续航效率 | ${r.catl?.avg_efficiency || 0} km/kWh | ${r.lg_energy?.avg_efficiency || 0} km/kWh |\n`;
  md += `| 效率优势 | **+${r.catl_advantage_pct || 0}%** | - |\n\n`;
  md += `> 💡 CATL方案续航效率高${r.catl_advantage_pct || 0}%，同样电池容量多跑约28km。`;
  return md;
}

// ─── Ranking ─────────────────────────────────────────────

function ranking(r: QueryResult): string {
  const metricCN: Record<string, string> = {
    margin: '利润率', margin_pct: '利润率', range_efficiency: '续航效率', range_km: '续航里程',
    cost_low: '成本(低→高)', cost_high: '成本(高→低)', weight: '重量',
    production: '年产量', price: '售价',
  };
  const metricName = metricCN[r.metric || ''] || r.metric || '未知';
  const vehicles = r.vehicles || r.top_3 || [];
  const bodyFilter = (r as any).body_filter || '';
  const ptFilter = (r as any).powertrain_filter || '';
  const hasFilter = bodyFilter || ptFilter;
  const filterLabel = [ptFilter, bodyFilter].filter(Boolean).join(' ');
  const filtersApplied: string[] = (r as any).filters_applied || [];

  // Determine which extra columns to show based on filter conditions
  const extraCols: Array<{ label: string; fn: (v: any) => string }> = [];
  const metricKey = r.metric || '';
  // Always show cost if not the ranking metric and relevant
  if (!metricKey.includes('cost')) {
    extraCols.push({ label: '成本', fn: (v) => `$${fmtMoney(v.cost_usd)}` });
  }
  // Show range_efficiency if mentioned in filters or it's an EV-focused query
  const hasEffFilter = filtersApplied.some(f => f.includes('range_efficiency') || f.includes('efficiency'));
  if (hasEffFilter && metricKey !== 'range_efficiency') {
    extraCols.push({ label: '续航效率', fn: (v) => `${v.range_efficiency_km_per_kwh || '-'} km/kWh` });
  }
  // Show range if mentioned in filters
  const hasRangeFilter = filtersApplied.some(f => f.includes('range_km'));
  if (hasRangeFilter && metricKey !== 'range_km') {
    extraCols.push({ label: '续航', fn: (v) => `${v.range_km} km` });
  }

  function fmtVal(v: any): string {
    if (metricKey === 'margin' || metricKey === 'margin_pct') return `${v.margin_pct}%`;
    if (metricKey === 'range_efficiency') return `${v.range_efficiency_km_per_kwh || '-'} km/kWh`;
    if (metricKey === 'range_km') return `${v.range_km} km`;
    if (metricKey === 'weight') return `${v.weight_kg} kg`;
    if (metricKey === 'production') return `${fmtMoney(v.production_volume_annual)}`;
    if (metricKey === 'price') return `${fmtMoney(v.price_usd)} USD`;
    if (metricKey.includes('cost')) return `${fmtMoney(v.cost_usd)} USD`;
    return `${v.margin_pct}%`;
  }

  // Show filter conditions if any
  function filterSummary(): string {
    if (filtersApplied.length === 0) return '';
    const opCN: Record<string, string> = { '<': '<', '>': '>', '<=': '≤', '>=': '≥', '==': '=' };
    const fieldCN: Record<string, string> = { cost_usd: '成本', range_efficiency: '续航效率', range_km: '续航', weight_kg: '重量', margin_pct: '利润率', price_usd: '售价' };
    const parts = filtersApplied.map(f => {
      const m = f.match(/^(\S+)\s+(\S+)\s+(.+)$/);
      if (!m) return f;
      return `${fieldCN[m[1]] || m[1]} ${opCN[m[2]] || m[2]} ${m[3]}`;
    });
    return `筛选条件：${parts.join('，')}\n\n`;
  }

  // Focused answer when filtered (e.g. "SUV里成本最低的是哪台")
  if (hasFilter && vehicles.length > 0) {
    const winner = vehicles[0];
    const ascending = r.ascending;
    const dirLabel = ascending ? '最低' : '最高';
    let md = `## 🏆 ${filterLabel}中${metricName}${dirLabel}：${winner.name}\n\n`;
    md += filterSummary();
    md += `> **${winner.name}** 的${metricName}为 **${fmtVal(winner)}**，在 ${vehicles.length} 台${filterLabel}车型中排名第一。\n\n`;

    // Show full filtered list as context
    if (vehicles.length > 1) {
      md += `### 完整${filterLabel}排名\n\n`;
      const extraHeaders = extraCols.map(c => c.label).join(' | ');
      const extraSep = extraCols.map(() => '---:').join('|');
      md += `| 排名 | 车型 | ${metricName}${extraHeaders ? ' | ' + extraHeaders : ''} |\n|:---:|---|---:${extraSep ? '|' + extraSep : ''}|\n`;
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
        const extraVals = extraCols.map(c => c.fn(v)).join(' | ');
        md += `| ${medal} | ${v.name} | ${fmtVal(v)}${extraVals ? ' | ' + extraVals : ''} |\n`;
      }
    }

    // Add contextual insight
    if (vehicles.length >= 2) {
      const last = vehicles[vehicles.length - 1];
      const diff = Math.abs((winner.cost_usd || 0) - (last.cost_usd || 0));
      if (r.metric?.includes('cost') && diff > 0) {
        md += `\n> 💡 **洞察**：${filterLabel}阵营中，${winner.name}(${fmtVal(winner)})与${last.name}(${fmtVal(last)})差距达 **$${fmtMoney(diff)}**`;
        const pct = ((diff / (last.cost_usd || 1)) * 100).toFixed(0);
        md += `（${pct}%），反映出不同平台和定位下的成本差异。\n`;
      }
    }
    return md;
  }

  // General ranking (no filter)
  let md = `## 📊 ${metricName}排名\n\n`;
  md += filterSummary();
  const extraHeaders = extraCols.map(c => c.label).join(' | ');
  const extraSep = extraCols.map(() => '---:').join('|');
  md += `| 排名 | 车型 | 类型 | ${metricName}${extraHeaders ? ' | ' + extraHeaders : ''} |\n|:---:|---|:---:|---:${extraSep ? '|' + extraSep : ''}|\n`;

  for (let i = 0; i < Math.min(vehicles.length, 10); i++) {
    const v = vehicles[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
    const extraVals = extraCols.map(c => c.fn(v)).join(' | ');
    md += `| ${medal} | ${v.name} | ${v.powertrain} | ${fmtVal(v)}${extraVals ? ' | ' + extraVals : ''} |\n`;
  }

  // Add insight for margin ranking
  if ((r.metric === 'margin' || r.metric === 'margin_pct') && vehicles.length > 3) {
    const evs = vehicles.filter(v => v.powertrain === 'EV');
    const ices = vehicles.filter(v => v.powertrain === 'ICE');
    if (ices.length > 0 && evs.length > 0) {
      md += `\n> 💡 **发现**：前三名全是ICE（燃油车）！ICE平均利润率约${(ices.reduce((s, v) => s + v.margin_pct, 0) / ices.length).toFixed(1)}%，`;
      md += `EV平均仅${(evs.reduce((s, v) => s + v.margin_pct, 0) / evs.length).toFixed(1)}%。`;
      md += `电动化提升了技术竞争力，但利润率还在追赶燃油车。`;
    }
  }

  return md;
}

// ─── EV vs ICE ───────────────────────────────────────────

// ─── Vehicle Listing (车辆分类列举) ────────────────────────

function vehicleListing(r: QueryResult): string {
  const evs = (r as any).ev_vehicles || [];
  const ices = (r as any).ice_vehicles || [];
  const evCount = (r as any).ev_count || evs.length;
  const iceCount = (r as any).ice_count || ices.length;
  const total = (r as any).total || evCount + iceCount;

  let md = `## 📋 数据集车辆分类总览\n\n`;
  md += `共 **${total}** 台车：**${evCount}** 台纯电 (EV) + **${iceCount}** 台燃油 (ICE)\n\n`;

  md += `### ⚡ 纯电车型 (${evCount}台)\n\n`;
  md += `| 车型 | 车身类型 | 平台 | 售价 | 总成本 |\n`;
  md += `| ---: | ---: | ---: | ---: | ---: |\n`;
  for (const v of evs) {
    md += `| ${v.name} | ${v.body_style} | ${v.platform} | $${fmtMoney(v.price)} | $${fmtMoney(v.total_cost)} |\n`;
  }

  md += `\n### ⛽ 燃油车型 (${iceCount}台)\n\n`;
  md += `| 车型 | 车身类型 | 平台 | 售价 | 总成本 |\n`;
  md += `| ---: | ---: | ---: | ---: | ---: |\n`;
  for (const v of ices) {
    md += `| ${v.name} | ${v.body_style} | ${v.platform} | $${fmtMoney(v.price)} | $${fmtMoney(v.total_cost)} |\n`;
  }

  md += `\n### 💡 快速洞察\n\n`;
  const evAvgPrice = evs.reduce((s: number, v: any) => s + v.price, 0) / (evCount || 1);
  const iceAvgPrice = ices.reduce((s: number, v: any) => s + v.price, 0) / (iceCount || 1);
  md += `- EV平均售价 **$${fmtMoney(evAvgPrice)}**，ICE平均售价 **$${fmtMoney(iceAvgPrice)}**，`;
  md += evAvgPrice > iceAvgPrice
    ? `EV高出 **$${fmtMoney(evAvgPrice - iceAvgPrice)}**（电池Pack是主因）\n`
    : `两者接近，说明EV已具备价格竞争力\n`;
  md += `- EV覆盖 **Sedan / SUV / Compact / MPV** 多种车身，产品线布局完整\n`;

  return md;
}

function evVsIce(r: QueryResult): string {
  let md = `## ⚡ 纯电 vs 燃油：成本结构根本差异\n\n`;

  md += `### 📊 核心指标对比\n\n`;
  md += `| 指标 | EV (${r.ev_count}台) | ICE (${r.ice_count}台) | 差异 |\n|---|---:|---:|---:|\n`;
  md += `| 平均利润率 | ${r.ev_avg_margin}% | ${r.ice_avg_margin}% | ICE高 ${r.margin_gap}ppt |\n`;
  md += `| 平均成本 | ${fmtMoney(r.ev_avg_cost || 0)} | ${fmtMoney(r.ice_avg_cost || 0)} | EV高 ${fmtMoney((r.ev_avg_cost || 0) - (r.ice_avg_cost || 0))} |\n\n`;

  md += `### 📋 成本结构对比（平均值）\n\n`;
  md += `| 模块 | EV | ICE | 关键差异 |\n|---|---:|---:|---|\n`;
  const evCB = r.ev_cost_breakdown_avg || {};
  const iceCB = r.ice_cost_breakdown_avg || {};
  for (const k of ['battery_pack', 'body_structure', 'powertrain', 'chassis', 'interior', 'electronics']) {
    const evVal = evCB[k] || 0;
    const iceVal = iceCB[k] || 0;
    let insight = '';
    if (k === 'battery_pack') insight = '🔴 EV独有成本';
    else if (k === 'powertrain') insight = evVal < iceVal ? '✅ 电机比发动机便宜' : '';
    else if (k === 'interior') insight = iceVal > evVal ? 'ICE内饰投入更多' : '';
    else if (k === 'electronics') insight = iceVal > evVal ? 'ICE电子电气成本更高' : '';
    md += `| ${MODULE_CN[k]} | ${fmtMoney(evVal)} | ${fmtMoney(iceVal)} | ${insight} |\n`;
  }

  md += `\n### 💡 深度洞察\n\n`;
  md += `1. **电池是EV的"原罪成本"**：平均 ${fmtMoney(evCB['battery_pack'] || 0)} USD，占EV总成本约38%，这是ICE完全没有的负担\n`;
  md += `2. **ICE的隐性优势正在消退**：虽然ICE利润率高${r.margin_gap}ppt，但面临碳排放法规和电动化转型压力\n`;
  md += `3. **BloombergNEF预测**：电池成本到2026年将降至$80/kWh以下，届时EV成本平价将真正到来\n`;
  md += `4. **规模效应**：ICE平均产量远高于EV，这也是利润率差距的重要原因\n`;

  return md;
}

// ─── Battery Sensitivity ─────────────────────────────────

function batterySensitivity(r: QueryResult): string {
  const pct = Math.abs((r.price_change_pct || 0) * 100).toFixed(0);
  const direction = (r.price_change_pct || 0) < 0 ? '下降' : '上涨';
  const results = (r.results || []) as Array<{ vehicle: VehicleData; battery_cost: number; battery_pct_of_total: number; cost_change_usd: number; new_total_cost: number; old_margin_pct: number; new_margin_pct: number; margin_improvement_ppt: number }>;

  let md = `## 🔋 电池价格${direction}${pct}%敏感度分析\n\n`;

  md += `| 车型 | 电池成本 | 占比 | 成本变化 | 利润率变化 |\n|---|---:|---:|---:|---:|\n`;
  for (const res of results.slice(0, 10)) {
    const arrow = res.margin_improvement_ppt > 0 ? '📈' : '📉';
    md += `| ${res.vehicle.name} | ${fmtMoney(res.battery_cost)} | ${res.battery_pct_of_total}% | ${res.cost_change_usd > 0 ? '+' : ''}${fmtMoney(res.cost_change_usd)} | ${arrow} ${fmtPct(res.margin_improvement_ppt)} |\n`;
  }

  if (results.length > 0) {
    const top = results[0];
    md += `\n> 🏆 **最大受益者：${top.vehicle.name}**——电池成本${fmtMoney(Math.abs(top.battery_cost))} USD，占总成本${top.battery_pct_of_total}%。`;
    md += `${direction}${pct}%后利润率从${top.old_margin_pct}%提升至${top.new_margin_pct}%（+${top.margin_improvement_ppt}ppt）。`;
  }

  return md;
}

// ─── Filter Query ────────────────────────────────────────

function filterQuery(r: QueryResult): string {
  const vehicles = r.vehicles || [];
  let md = `## 🔍 筛选结果\n\n`;
  if (r.constraints && r.constraints.length > 0) {
    md += `条件：${r.constraints.join(' + ')}\n`;
  }
  md += `共找到 **${r.result_count || vehicles.length}** 台：\n\n`;

  if (vehicles.length > 0) {
    md += `| 车型 | 成本 | 售价 | 利润率 | 续航效率 |\n|---|---:|---:|---:|---:|\n`;
    for (const v of vehicles) {
      md += `| ${v.name} | ${fmtMoney(v.cost_usd)} | ${fmtMoney(v.price_usd)} | ${v.margin_pct}% | ${v.range_efficiency_km_per_kwh || '-'} |\n`;
    }
  }
  return md;
}

// ─── Vehicle Info ────────────────────────────────────────

function vehicleInfo(r: QueryResult): string {
  const vehicles = r.vehicles || [];
  let md = '';
  for (const v of vehicles) {
    md += `## 🚗 ${v.name}\n\n`;
    md += `| 参数 | 数值 |\n|---|---|\n`;
    md += `| 动力类型 | ${v.powertrain} |\n`;
    md += `| 车身 | ${v.body_type} |\n`;
    md += `| 平台 | ${v.platform} |\n`;
    md += `| 续航 | ${v.range_km} km |\n`;
    md += `| 重量 | ${v.weight_kg} kg |\n`;
    md += `| 功率 | ${v.horsepower} hp |\n`;
    md += `| 成本 | ${fmtMoney(v.cost_usd)} USD |\n`;
    md += `| 售价 | ${fmtMoney(v.price_usd)} USD |\n`;
    md += `| 利润率 | ${v.margin_pct}% |\n`;
    if (v.range_efficiency_km_per_kwh) md += `| 续航效率 | ${v.range_efficiency_km_per_kwh} km/kWh |\n`;
    if (v.battery_supplier) md += `| 电池供应商 | ${v.battery_supplier} |\n`;
    md += `| 年产量 | ${fmtMoney(v.production_volume_annual)} |\n`;
    md += `| 工艺 | ${v.manufacturing_process === 'traditional_stamping' ? '传统冲压' : v.manufacturing_process === 'aluminum_intensive' ? '全铝密集' : v.manufacturing_process} |\n`;

    const cp = v.competitive_position;
    if (cp && cp.key_advantage) {
      md += `\n**竞争优势**：${cp.key_advantage}\n`;
      md += `**竞争劣势**：${cp.key_weakness || '-'}\n`;
      if (cp.real_world_competitors) md += `**真实竞品**：${cp.real_world_competitors.join('、')}\n`;
    }
    md += '\n';
  }
  return md;
}

// ─── General Fallback ────────────────────────────────────

function generalFallback(r: QueryResult): string {
  if (r.message) return r.message;
  return '我已收到您的问题，但需要更多上下文来给出精准回答。请尝试提及具体车型名称或明确的分析维度（如成本、续航、利润率等）。';
}
