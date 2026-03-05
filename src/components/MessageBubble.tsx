import React from 'react';

interface Props {
  message: { role: 'user' | 'assistant'; content: string };
}

// Simple markdown→HTML (supports headers, bold, tables, blockquotes, lists, code, hr)
function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 rounded text-xs">$1</code>')
    .replace(/^&gt; (.+)$/gm, '<div class="border-l-4 border-primary pl-3 py-1 my-2 bg-primary/5 rounded-r text-sm">$1</div>')
    .replace(/^---$/gm, '<hr class="my-3 border-base-300"/>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$2</li>');

  html = html.replace(/(\|.+\|\n)+/g, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => !r.match(/^\|[\s\-:]+\|$/));
    if (rows.length === 0) return tableBlock;
    let t = '<div class="overflow-x-auto my-2"><table class="table table-xs table-zebra w-full"><thead><tr>';
    const headerCells = rows[0].split('|').filter(c => c.trim());
    headerCells.forEach(c => { t += `<th class="text-xs">${c.trim()}</th>`; });
    t += '</tr></thead><tbody>';
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split('|').filter(c => c.trim());
      t += '<tr>';
      cells.forEach(c => { t += `<td class="text-xs">${c.trim()}</td>`; });
      t += '</tr>';
    }
    t += '</tbody></table></div>';
    return t;
  });

  html = html.replace(/\n{2,}/g, '</p><p class="text-sm my-1">');
  return `<p class="text-sm my-1">${html}</p>`;
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
