import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, MessageSquare, Github } from 'lucide-react';
import { MessageBubble } from './components/MessageBubble';
import { SuggestedQuestions } from './components/SuggestedQuestions';
import { PipelineViz } from './components/PipelineViz';
import { LLMSettings, getLLMConfig } from './components/LLMSettings';
import type { LLMConfig } from './components/LLMSettings';
import { process as queryProcess, classifyIntent } from './engine/queryEngine';
import type { HistoryEntry, IntentResult } from './engine/queryEngine';
import { llmNLU, llmNLG, llmChat } from './utils/llm';
import { generateInsight } from './utils/insights';

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  vehicles?: string[];
  timestamp: number;
}

// Adapter for MessageBubble which expects types.ts ChatMessage
function toChatMessage(msg: ChatMsg): { role: 'user' | 'assistant'; content: string } {
  return { role: msg.role, content: msg.content };
}

export default function App() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<'idle' | 'nlu' | 'skill' | 'nlg' | 'done'>('idle');
  const [currentIntent, setCurrentIntent] = useState<string>('');
  const [nluMode, setNluMode] = useState<string>('');
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(getLLMConfig());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildHistory = useCallback((): HistoryEntry[] => {
    return messages.slice(-8).map(m => ({
      role: m.role,
      content: m.content,
      vehicles: m.vehicles,
    }));
  }, [messages]);

  const handleSubmit = async (question: string) => {
    if (!question.trim() || loading) return;
    const userMsg: ChatMsg = { id: String(Date.now()), role: 'user', content: question.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setPipelineStep('nlu');
    setCurrentIntent('');
    setNluMode('');

    try {
      const history = buildHistory();
      const llmEnabled = llmConfig.enabled && !!llmConfig.apiKey;

      // Step 1: NLU
      let intentResult: IntentResult | undefined;
      let nluModeStr = 'rule';

      if (llmEnabled) {
        nluModeStr = 'llm';
        setNluMode('LLM');
        try {
          const nluResult = await llmNLU(llmConfig, question, history);
          if (!nluResult.error) {
            intentResult = nluResult as IntentResult;
          }
        } catch (e) {
          console.warn('LLM NLU fallback to rules:', e);
        }
      }

      if (!intentResult) {
        intentResult = classifyIntent(question, history);
        nluModeStr = 'rule';
        setNluMode('规则');
      }
      setCurrentIntent(intentResult.intent);

      // Step 2: Handle general intent (direct LLM chat)
      if (intentResult.intent === 'general' && llmEnabled) {
        setPipelineStep('nlg');
        const chatResult = await llmChat(llmConfig, question, history);
        const answer = chatResult.text || '抱歉，暂时无法回答这个问题。';
        setPipelineStep('done');
        setMessages(prev => [...prev, { id: String(Date.now()), role: 'assistant', content: answer, vehicles: [], timestamp: Date.now() }]);
        setLoading(false);
        return;
      }

      // Step 3: Skill execution
      setPipelineStep('skill');
      const result = queryProcess(question, history, intentResult);

      // Step 4: NLG
      setPipelineStep('nlg');
      let answer: string;

      if (llmEnabled && result.status === 'ok') {
        try {
          const nlgResult = await llmNLG(llmConfig, question, result, history);
          answer = nlgResult.text || generateInsight(result);
        } catch {
          answer = generateInsight(result);
        }
      } else {
        answer = generateInsight(result);
      }

      // Extract vehicle names for context
      const vehicleNames: string[] = [];
      if (result.vehicle?.name) vehicleNames.push(result.vehicle.name);
      if (result.vehicle_1?.name) vehicleNames.push(result.vehicle_1.name);
      if (result.vehicle_2?.name) vehicleNames.push(result.vehicle_2.name);
      if (result.vehicles) {
        for (const v of result.vehicles) {
          const name = typeof v === 'string' ? v : v?.name || v?.vehicle?.name;
          if (name && !vehicleNames.includes(name)) vehicleNames.push(name);
        }
      }
      if (result.top_3) {
        for (const v of result.top_3) {
          const name = v?.name || v?.vehicle?.name;
          if (name && !vehicleNames.includes(name)) vehicleNames.push(name);
        }
      }
      if (result.top_3_heaviest) {
        for (const r of result.top_3_heaviest) {
          const name = r?.vehicle?.name;
          if (name && !vehicleNames.includes(name)) vehicleNames.push(name);
        }
      }
      if (result.results) {
        for (const r of result.results) {
          const name = r?.vehicle?.name;
          if (name && !vehicleNames.includes(name)) vehicleNames.push(name);
        }
      }

      setPipelineStep('done');
      setMessages(prev => [...prev, { id: String(Date.now()), role: 'assistant', content: answer, vehicles: vehicleNames, timestamp: Date.now() }]);
    } catch (err) {
      console.error('Query error:', err);
      setMessages(prev => [...prev, { id: String(Date.now()), role: 'assistant', content: `❌ 处理出错：${err instanceof Error ? err.message : String(err)}`, vehicles: [], timestamp: Date.now() }]);
      setPipelineStep('idle');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(input); }
  };

  const handleReset = () => {
    setMessages([]);
    setPipelineStep('idle');
    setCurrentIntent('');
    setNluMode('');
  };

  return (
     <div data-theme="light" className="flex flex-col h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="navbar bg-base-200 border-b px-4 py-0 min-h-12">
        <div className="flex-1 gap-2">
          <span className="text-lg font-bold">🚗 汽车工程智能问答</span>
          <span className="badge badge-sm badge-ghost hidden sm:inline-flex">NLU→Skill→NLG</span>
        </div>
        <div className="flex-none gap-1">
          <LLMSettings onConfigChange={setLlmConfig} />
          <button className="btn btn-ghost btn-sm" onClick={handleReset} title="重置对话">
            <RotateCcw size={14} />
          </button>
        </div>
      </header>

      {/* Pipeline Visualization */}
      <div className="border-b">
        <PipelineViz activeStep={pipelineStep} intent={currentIntent} nluMode={nluMode} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <SuggestedQuestions onSelect={handleSubmit} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            {loading && (
              <div className="chat chat-start">
                <div className="chat-image avatar placeholder">
                  <div className="w-8 rounded-full bg-secondary text-secondary-content">
                    <span className="text-xs">AI</span>
                  </div>
                </div>
                <div className="chat-bubble chat-bubble-secondary">
                  <span className="loading loading-dots loading-sm"></span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t bg-base-200 p-3">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            className="textarea textarea-bordered flex-1 min-h-[2.5rem] max-h-[6rem] resize-none text-sm leading-snug"
            placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
          />
          <button
            className="btn btn-primary btn-sm self-end"
            onClick={() => handleSubmit(input)}
            disabled={!input.trim() || loading}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-xs text-base-content/40 mt-2">
          15款车型 · 6大成本模块 · 一体化压铸仿真 · 供应商对比
        </p>
      </div>
    </div>
  );
}
