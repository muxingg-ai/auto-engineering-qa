/**
 * LLM Service - Browser-based (uses fetch API instead of Python)
 * Supports OpenAI, Anthropic (Claude), DeepSeek
 */
import type { LLMConfig } from '../components/LLMSettings';
import type { HistoryEntry } from '../engine/queryEngine';

export interface NLUResult {
  intent: string;
  vehicles: string[];
  metric?: string;
  ascending?: boolean;
  body_filter?: string;
  powertrain_filter?: string;
  filters?: Array<{ field: string; op: string; value: number }>;
  confidence?: number;
  error?: string;
}

export interface NLGResult {
  text: string;
  error?: string;
}

// ─── System Prompts ──────────────────────────────────────

const NLU_SYSTEM_PROMPT = `You are an automotive cost engineering NLU system. Your job is to classify user questions into intents and extract parameters.

## Available Vehicles (15 total)
Aurora_L, Falcon_X, Nebula_Pro, Orion_Max, Comet_E, Tiger_GT, Swift_E, Electra_S, Volt_Mini, Urban_E, Ranger_T, Desert_King, City_Gas, Family_Van, Mini_Gas

## Available Intents
- \`cost_comparison\` — Compare costs of 2 vehicles. Needs exactly 2 vehicle names.
- \`cost_breakdown\` — Show cost structure of 1+ vehicles. Needs vehicle names.
- \`weight_analysis\` — Analyze weight and improvement options. Needs vehicle names.
- \`competitive_strategy\` — Find benchmark for target price point.
- \`gigacasting_top_heavy\` — Counterfactual: top 3 heaviest + gigacasting.
- \`gigacasting_sim\` — Simulate gigacasting for specific vehicles.
- \`supplier_switch\` — Analyze battery supplier switch. Needs vehicle names.
- \`supplier_analysis\` — Compare CATL vs LG across all vehicles.
- \`ranking\` — Rank vehicles by metric. Extract metric and ascending.
  - Metrics: margin, cost_low, cost_high, range_km, range_efficiency, weight, production, price
  - ascending=true for: 最低, 最小, 最轻, 最少, 最便宜
- \`vehicle_listing\` — List all vehicles by EV/ICE categories.
- \`ev_vs_ice\` — Compare EV vs ICE cost structures.
- \`battery_sensitivity\` — Battery price change impact.
- \`filter_query\` — Filter vehicles by constraints.
- \`vehicle_info\` — Show vehicle details.
- \`general\` — Conversational or general knowledge questions NOT about specific vehicle data.

## Context References
Words like 刚才, 这些, 它们, 那几款, 提到的 refer to vehicles from previous conversation.

## Output Format
Return ONLY valid JSON:
{
  "intent": "one_of_the_intents_above",
  "vehicles": ["Vehicle_Name", ...],
  "metric": "metric_name",
  "ascending": true/false,
  "body_filter": "SUV",
  "powertrain_filter": "EV",
  "filters": [{"field": "cost_usd", "op": "<", "value": 40000}],
  "confidence": 0.95
}

### Filter field names: cost_usd, price_usd, range_km, range_efficiency, weight_kg, margin_pct, production_volume_annual, horsepower, battery_kwh
Vehicle names MUST match exactly (case-sensitive with underscores).`;

const NLG_SYSTEM_PROMPT = `你是一位资深汽车成本工程专家，擅长从结构化数据中提炼人看不到的洞见。

## 核心规则（必须严格遵守）
1. **所有数字必须来自提供的数据，绝对不能编造或四舍五入**
2. **数值变化方向必须正确判断**：
   - 如果 A→B 且 B < A，这是"降低/减少/下降"，绝对不能说"提升/增加/上升"
   - 如果 A→B 且 B > A，这是"提升/增加/上升"，绝对不能说"降低/减少/下降"
3. **对比分析时先做数学运算再下结论**
4. **不确定时不要下结论**

## 输出格式
- 用中文生成分析，使用 markdown 格式
- 简洁但有洞察力
- 适当使用表格展示对比数据
- 用 💡 标注非显而易见的发现
- 直接输出 markdown，不要用 JSON 包裹`;

const CHAT_SYSTEM_PROMPT = `你是一位资深汽车成本工程专家。用户可能会问概念解释、术语含义、对之前对话的追问等。
用中文回答，使用 markdown 格式，简洁、专业、有洞察力。`;

// ─── API Call Layer ──────────────────────────────────────

async function callOpenAICompatible(baseUrl: string, apiKey: string, model: string, messages: any[], temperature: number): Promise<string> {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, max_tokens: 4096 }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices[0].message.content;
}

async function callAnthropic(baseUrl: string, apiKey: string, model: string, messages: any[], temperature: number): Promise<string> {
  const systemText = messages.find((m: any) => m.role === 'system')?.content || '';
  const apiMessages = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({ role: m.role, content: m.content }));

  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system: systemText, messages: apiMessages, temperature }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.content[0].text;
}

async function callLLM(config: LLMConfig, messages: any[], temperature: number): Promise<string> {
  const { provider, apiKey, model } = config;
  const baseUrl = (config.baseUrl || '').replace(/\/$/, '');

  if (provider === 'openai') return callOpenAICompatible(baseUrl || 'https://api.openai.com/v1', apiKey, model, messages, temperature);
  if (provider === 'deepseek') return callOpenAICompatible(baseUrl || 'https://api.deepseek.com/v1', apiKey, model, messages, temperature);
  if (provider === 'anthropic') return callAnthropic(baseUrl || 'https://api.anthropic.com', apiKey, model, messages, temperature);
  throw new Error(`Unknown provider: ${provider}`);
}

// ─── History Helpers ─────────────────────────────────────

function trimHistory(history: HistoryEntry[], maxTurns = 4): HistoryEntry[] {
  return history.slice(-maxTurns).map(h => ({
    ...h,
    content: h.content.length > 300 ? h.content.slice(0, 300) + '...' : h.content,
  }));
}

function trimResultForNLG(result: any): any {
  const trimmed: any = { intent: result.intent, status: result.status };
  for (const [key, val] of Object.entries(result)) {
    if (key === 'intent' || key === 'status') continue;
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') trimmed[key] = val;
  }
  for (const [key, val] of Object.entries(result)) {
    if (!Array.isArray(val)) continue;
    trimmed[key] = (val as any[]).slice(0, 8).map((item: any) => {
      if (typeof item !== 'object' || item === null) return item;
      const slim: any = {};
      const keepFields = ['name', 'body_style', 'type', 'platform', 'price', 'total_cost', 'margin', 'margin_pct', 'cost_reduction', 'weight_kg', 'range_km', 'battery', 'motor', 'electronics', 'body', 'chassis', 'interior', 'rank', 'value', 'metric', 'savings', 'new_cost', 'original_cost'];
      for (const f of keepFields) { if (f in item) slim[f] = item[f]; }
      return Object.keys(slim).length > 0 ? slim : item;
    });
    if ((val as any[]).length > 8) trimmed[`${key}_total`] = (val as any[]).length;
  }
  for (const [key, val] of Object.entries(result)) {
    if (key in trimmed) continue;
    if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      const str = JSON.stringify(val);
      if (str.length > 800) {
        const slim: any = {};
        for (const [k2, v2] of Object.entries(val as Record<string, any>)) {
          if (typeof v2 === 'string' || typeof v2 === 'number' || typeof v2 === 'boolean') slim[k2] = v2;
          else if (Array.isArray(v2)) slim[k2] = v2.slice(0, 5);
        }
        trimmed[key] = slim;
      } else trimmed[key] = val;
    }
  }
  return trimmed;
}

// ─── Public API ──────────────────────────────────────────

export async function llmNLU(config: LLMConfig, question: string, history: HistoryEntry[]): Promise<NLUResult> {
  try {
    const messages: any[] = [{ role: 'system', content: NLU_SYSTEM_PROMPT }];
    if (history.length) {
      let historyText = '## Recent Conversation History\n';
      for (const h of trimHistory(history, 6)) {
        const vStr = h.vehicles?.length ? ` [vehicles: ${h.vehicles.join(', ')}]` : '';
        historyText += `- ${h.role}: ${h.content}${vStr}\n`;
      }
      messages.push({ role: 'user', content: `${historyText}\n## Current Question\n${question}` });
    } else {
      messages.push({ role: 'user', content: question });
    }
    let raw = await callLLM(config, messages, 0.3);
    let text = raw.trim();
    if (text.startsWith('```')) {
      const lines = text.split('\n').filter(l => !l.trim().startsWith('```'));
      text = lines.join('\n').trim();
    }
    const result = JSON.parse(text);
    if (!result.intent) result.intent = 'general';
    if (!result.vehicles) result.vehicles = [];
    if (!result.confidence) result.confidence = 0.8;
    return result;
  } catch (err) {
    console.warn('LLM NLU fallback:', err);
    return { error: err instanceof Error ? err.message : String(err), intent: 'general', vehicles: [] };
  }
}

export async function llmNLG(config: LLMConfig, question: string, result: any, history: HistoryEntry[]): Promise<NLGResult> {
  try {
    const messages: any[] = [{ role: 'system', content: NLG_SYSTEM_PROMPT }];
    if (history.length) {
      let historyText = '';
      for (const h of trimHistory(history, 2)) historyText += `${h.role === 'user' ? '用户' : '助手'}: ${h.content}\n`;
      messages.push({ role: 'user', content: `对话历史:\n${historyText}` });
      messages.push({ role: 'assistant', content: '好的，我了解上下文了。' });
    }
    const userPrompt = `用户问题: ${question}\n\n查询结果数据 (JSON):\n\`\`\`json\n${JSON.stringify(trimResultForNLG(result), null, 2)}\n\`\`\`\n\n请基于以上数据生成专业的分析洞察。\n\n⚠️ 重要提醒：\n- 所有数字必须精确引用上面JSON中的值\n- 描述数值变化时，必须先计算差值再判断方向\n- 负数变化量表示减少，不是增加`;
    messages.push({ role: 'user', content: userPrompt });
    const text = await callLLM(config, messages, 0.3);
    return { text: text.trim() };
  } catch (err) {
    console.warn('LLM NLG fallback:', err);
    return { error: err instanceof Error ? err.message : String(err), text: '' };
  }
}

export async function llmChat(config: LLMConfig, question: string, history: HistoryEntry[]): Promise<NLGResult> {
  try {
    const messages: any[] = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }];
    for (const h of trimHistory(history, 6)) messages.push({ role: h.role, content: h.content });
    messages.push({ role: 'user', content: question });
    const text = await callLLM(config, messages, 0.7);
    return { text: text.trim() };
  } catch (err) {
    console.warn('LLM Chat fallback:', err);
    return { error: err instanceof Error ? err.message : String(err), text: '' };
  }
}
