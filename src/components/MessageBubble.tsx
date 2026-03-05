import React from 'react';

interface Props {
  message: { role: 'user' | 'assistant'; content: string };
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-3 mb-1 text-white">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-4 mb-2 text-white">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-4 mb-2 text-white">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 rounded text-xs text-white">$1</code>')
    .replace(/^&gt; (.+)$/gm, '<div class="border-l-4 border-primary pl-3 py-1 my-2 bg-primary/5 rounded-r text-sm text-white">$1</div>')
    .replace(/^---$/gm, '<hr class="my-3 border-base-300"/>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-white">$1</li>')

  html = html.replace(/(\|.+\|\n)+/g, (tableBlock) => {
    const allRows = tableBlock.trim().split('\n');
    const headerRow = allRows[0];
    const dataRows = allRows.slice(1).filter(r => !r.match(/^\|[\s\-:]+\|$/));
    if (!headerRow) return tableBlock;

    // 表头白色文字
    let t = '<div class="overflow-x-auto my-2"><table class="table table-xs table-zebra w-full"><thead><tr>';
    const headerCells = headerRow.split('|').filter(c => c.trim());
    headerCells.forEach(c => {
      t += `<th class="text-xs" style="color:#ffffff">${c.trim()}</th>`;
    });
    t += '</tr></thead><tbody>';

    dataRows.forEach((row, index) => {
      const cells = row.split('|').filter(c => c.trim());
      const isLastRow = index === dataRows.length - 1;
      // 浅色背景行（奇数index 1,3,5... 以及最后一行）用深色文字
      // 深色背景行（偶数index 0,2,4...，除最后行）用白色文字
      const isLightBg = (index % 2 === 1) || isLastRow;
      const color = isLightBg ? '#0f172a' : '#ffffff';
      t += '<tr>';
      cells.forEach(c => {
        t += `<td class="text-xs" style="color:${color}">${c.trim()}</td>`;
      });
      t += '</tr>';
    });

    t += '</tbody></table></div>';
    return t;
  });

  html = html.replace(/\n{2,}/g, '</p><p class="text-sm my-1 text-white">');
  return `<p class="text-sm my-1 text-white">${html}</p>`;
}

export const MessageBubble: React.FC<Props> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`chat ${isUser ? 'chat-end' : 'chat-start'}`}>
      <div className="chat-image avatar placeholder">
        <div className={`w-8 rounded-full ${isUser ? 'bg-primary text-primary-content' : 'bg-secondary text-secondary-content'}`}>
          <span className="text-xs">{isUser ? '你' : 'AI'}</span>
        </div>
      </div>
      <div className={`chat-bubble ${isUser ? 'chat-bubble-primary' : 'chat-bubble-secondary'} max-w-[90%]`}>
        {isUser ? (
          <p className="text-sm">{message.content}</p>
        ) : (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
          />
        )}
      </div>
    </div>
  );
};
