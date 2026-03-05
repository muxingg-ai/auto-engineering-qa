import React from 'react';

interface Props {
  activeStep: 'idle' | 'nlu' | 'skill' | 'nlg' | 'done';
  intent?: string;
  nluMode?: string;
}

const STEPS = [
  { id: 'nlu', label: 'NLU', desc: '意图识别', icon: '🧠' },
  { id: 'skill', label: 'Skill', desc: '数据检索', icon: '🔧' },
  { id: 'nlg', label: 'NLG', desc: '智能生成', icon: '✨' },
];

export const PipelineViz: React.FC<Props> = ({ activeStep, intent, nluMode }) => {
  const stepIdx = activeStep === 'idle' ? -1 : activeStep === 'done' ? 3 : STEPS.findIndex(s => s.id === activeStep);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-base-200/50 rounded-lg text-xs">
      <span className="font-bold text-base-content/60 mr-1">Pipeline:</span>
      {STEPS.map((s, i) => {
        const isActive = s.id === activeStep;
        const isDone = stepIdx > i || activeStep === 'done';
        return (
          <React.Fragment key={s.id}>
            {i > 0 && <span className={`mx-0.5 ${isDone ? 'text-success' : 'text-base-content/30'}`}>→</span>}
            <span className={`badge badge-sm ${isActive ? 'badge-primary animate-pulse' : isDone ? 'badge-success' : 'badge-ghost'}`}>
              {s.icon} {s.label}
            </span>
          </React.Fragment>
        );
      })}
      {intent && (
        <span className="ml-2 text-base-content/50">
          Intent: <code className="text-primary">{intent}</code>
          {nluMode && <span className="ml-1">({nluMode})</span>}
        </span>
      )}
    </div>
  );
};
