import React from 'react';

interface Props {
  onSelect: (q: string) => void;
}

interface QuestionGroup {
  act: string;
  icon: string;
  color: string;
  questions: { text: string; followUp?: string }[];
}

const GROUPS: QuestionGroup[] = [
  {
    act: '第一幕：成本侦探',
    icon: '🔍',
    color: 'badge-primary',
    questions: [
      { text: 'Comet_E和Orion_Max都是EV SUV，为什么售价差了26000美元？成本差距主要来自哪些模块？', followUp: 'Comet_E这么重，是工艺问题还是设计问题？有没有改进空间？' },
      { text: 'Aurora_L的成本结构是什么？和行业对比如何？' },
    ],
  },
  {
    act: '第二幕：竞品参谋',
    icon: '🎯',
    color: 'badge-secondary',
    questions: [
      { text: '我们要开发一款定价3.5万美元的家用EV SUV，找最接近的对标车型，需要在哪些技术维度上超越它？' },
    ],
  },
  {
    act: '第三幕：反事实推演',
    icon: '🏭',
    color: 'badge-accent',
    questions: [
      { text: '数据库里重量最大的三台量产车，如果都换成一体化压铸工艺，分别能节省多少成本？哪台车最值得优先改造？考虑产量因素。' },
    ],
  },
  {
    act: '第四幕：行业洞察',
    icon: '📊',
    color: 'badge-info',
    questions: [
      { text: '哪款车的毛利率最高？' },
      { text: '纯电和燃油车的成本结构有什么根本差异？' },
      { text: '电池价格下降20%后，哪款车获利最大？' },
    ],
  },
];

export const SuggestedQuestions: React.FC<Props> = ({ onSelect }) => {
  return (
    <div className="space-y-4 p-4">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold">🚗 汽车工程智能问答</h2>
        <p className="text-base-content/60 text-sm mt-1">NLU → Skill → NLG 全流水线演示 · 15款车型 · 6大成本模块</p>
      </div>
      {GROUPS.map((g) => (
        <div key={g.act} className="card bg-base-200/50 shadow-sm">
          <div className="card-body p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{g.icon}</span>
              <span className={`badge ${g.color} badge-sm`}>{g.act}</span>
            </div>
            <div className="space-y-1">
              {g.questions.map((q, i) => (
                <button
                  key={i}
                  className="btn btn-ghost btn-sm justify-start text-left h-auto py-2 w-full font-normal text-sm leading-snug"
                  onClick={() => onSelect(q.text)}
                >
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
