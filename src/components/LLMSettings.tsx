import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Check, AlertCircle, Zap, ZapOff } from 'lucide-react';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'deepseek';
  model: string;
  apiKey: string;
  enabled: boolean;
  baseUrl?: string;
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: '',
  enabled: false,
};

const PROVIDER_MODELS: Record<string, { label: string; models: { id: string; name: string }[]; defaultBase: string }> = {
  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
    defaultBase: 'https://api.openai.com/v1',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    ],
    defaultBase: 'https://api.anthropic.com',
  },
  deepseek: {
    label: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
    defaultBase: 'https://api.deepseek.com/v1',
  },
};

const STORAGE_KEY = 'auto-qa-llm-config';

function loadConfig(): LLMConfig {
  try {
    const data = sessionStorage.getItem(STORAGE_KEY);
    if (data) return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG };
}

function saveConfigToSession(config: LLMConfig): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getLLMConfig(): LLMConfig {
  return loadConfig();
}

interface LLMSettingsProps {
  onConfigChange?: (config: LLMConfig) => void;
}

export const LLMSettings: React.FC<LLMSettingsProps> = ({ onConfigChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<LLMConfig>(DEFAULT_CONFIG);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);
    setLoaded(true);
    onConfigChange?.(c);
  }, []);

  const handleSave = () => {
    setSaveStatus('saving');
    try {
      saveConfigToSession(config);
      setSaveStatus('saved');
      onConfigChange?.(config);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleTest = async () => {
    if (!config.apiKey) { setTestStatus('error'); setTestError('请先输入 API Key'); return; }
    setTestStatus('testing');
    setTestError('');
    try {
      const provider = PROVIDER_MODELS[config.provider];
      const baseUrl = config.baseUrl || provider.defaultBase;

      if (config.provider === 'anthropic') {
        const resp = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({ model: config.model, max_tokens: 10, messages: [{ role: 'user', content: 'hi' }] }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      } else {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 10 }),
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      }
      setTestStatus('success');
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch (e: any) {
      setTestStatus('error');
      setTestError(e.message?.slice(0, 200) || '连接失败');
    }
  };

  const updateConfig = (partial: Partial<LLMConfig>) => {
    setConfig(prev => {
      const updated = { ...prev, ...partial };
      if (partial.provider && partial.provider !== prev.provider) {
        updated.model = PROVIDER_MODELS[partial.provider].models[0].id;
        updated.baseUrl = undefined;
      }
      return updated;
    });
    setSaveStatus('idle');
  };

  const providerInfo = PROVIDER_MODELS[config.provider];

  if (!loaded) return null;

  return (
    <>
      <button
        className={`btn btn-ghost btn-sm gap-1 ${config.enabled && config.apiKey ? 'text-success' : 'opacity-60'}`}
        onClick={() => setIsOpen(true)}
        title="LLM 设置"
      >
        {config.enabled && config.apiKey ? <Zap size={14} /> : <ZapOff size={14} />}
        <span className="text-xs">
          {config.enabled && config.apiKey ? providerInfo.label : 'LLM 未接入'}
        </span>
      </button>

      {isOpen && (
        <div className="modal modal-open" onClick={() => setIsOpen(false)}>
          <div className="modal-box max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings size={20} /> LLM 接入设置
            </h3>
            <p className="text-base-content/60 text-sm mt-1">
              接入大模型后，NLU和NLG将由LLM驱动，支持任意问题
            </p>
            <div className="divider my-2"></div>

            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text font-medium">启用 LLM</span>
                <input type="checkbox" className="toggle toggle-primary" checked={config.enabled} onChange={e => updateConfig({ enabled: e.target.checked })} />
              </label>
            </div>

            <div className="form-control mt-3">
              <label className="label"><span className="label-text">模型供应商</span></label>
              <select className="select select-bordered select-sm w-full" value={config.provider} onChange={e => updateConfig({ provider: e.target.value as LLMConfig['provider'] })}>
                {Object.entries(PROVIDER_MODELS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div className="form-control mt-3">
              <label className="label"><span className="label-text">模型</span></label>
              <select className="select select-bordered select-sm w-full" value={config.model} onChange={e => updateConfig({ model: e.target.value })}>
                {providerInfo.models.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="form-control mt-3">
              <label className="label"><span className="label-text">API Key</span></label>
              <label className="input input-bordered input-sm flex items-center gap-2">
                <input type={showKey ? 'text' : 'password'} className="grow" placeholder="sk-..." value={config.apiKey} onChange={e => updateConfig({ apiKey: e.target.value })} />
                <button className="btn btn-ghost btn-xs" onClick={() => setShowKey(!showKey)} type="button">
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </label>
              <label className="label">
                <span className="label-text-alt text-base-content/50">
                  🔒 Key 仅存于浏览器会话中，关闭页面即消失
                </span>
              </label>
            </div>

            <div className="form-control mt-2">
              <label className="label"><span className="label-text">自定义 Base URL（可选）</span></label>
              <input type="text" className="input input-bordered input-sm w-full" placeholder={providerInfo.defaultBase} value={config.baseUrl || ''} onChange={e => updateConfig({ baseUrl: e.target.value || undefined })} />
            </div>

            <div className="modal-action mt-4">
              <div className="flex gap-2 w-full">
                <button
                  className={`btn btn-sm btn-outline ${testStatus === 'success' ? 'btn-success' : testStatus === 'error' ? 'btn-error' : ''}`}
                  onClick={handleTest}
                  disabled={!config.apiKey || testStatus === 'testing'}
                >
                  {testStatus === 'testing' ? (<><span className="loading loading-spinner loading-xs"></span> 测试中...</>) :
                    testStatus === 'success' ? (<><Check size={14} /> 连接成功</>) :
                      testStatus === 'error' ? (<><AlertCircle size={14} /> 失败</>) : '测试连接'}
                </button>
                <div className="flex-1"></div>
                <button className="btn btn-sm btn-ghost" onClick={() => setIsOpen(false)}>取消</button>
                <button className={`btn btn-sm btn-primary ${saveStatus === 'saving' ? 'loading' : ''}`} onClick={handleSave}>
                  {saveStatus === 'saved' ? <><Check size={14} /> 已保存</> : '保存'}
                </button>
              </div>
              {testStatus === 'error' && testError && (
                <div className="alert alert-error alert-sm mt-2 text-xs">
                  <AlertCircle size={14} /><span>{testError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
