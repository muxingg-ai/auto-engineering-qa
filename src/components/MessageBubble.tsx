import React from 'react';

interface Props {
  message: { role: 'user' | 'assistant'; content: string };
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 style="font-weight:bold;font-size:0.875rem;margin-top:0.75rem;margin-bottom:0.25rem;color:#ffffff">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-weight:bold;font-size:1rem;margin-top:1rem;margin-bottom:0.5rem;color:#ffffff">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-weight:bold;font-size:1.125rem;margin-top:1rem;margin-bottom:0.5rem;color:#ffffff">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#ffffff">$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.2);padding:0 4px;border-radius:4px;font-size:0.75rem;color:#ffffff">$1</code>')
    .replace(/^&gt; (.+)$/gm, '<div style="border-left:4px solid #93c5fd;padding:4px 12px;margin:8px 0;color:#ffffff;font-size:0.875rem">$1</div>')
    .replace(/^---$/gm, '<hr style="margin:12px 0;border-color:rgba(255,255,255,0.3)"/>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:1rem;list-style:disc;font-size:0.875rem;color:#ffffff">$1</li>')

  html = html.replace(/(\|.+\|\n)+/g, (tableBlock) => {
    const allRows = tableBlock.trim().split('\n');
    const headerRow = allRows[0];
    const dataRows = allRows.slice(1).filter(r => !r.match(/^\|[\s\-:]+\|$/));
    if (!headerRow) return tableBlock;

    const cellStyle = 'style="padding:6px 8px;font-size:0.75rem;border-bottom:1px solid rgba(255,255,255,0.2);color:#ffffff"';
    const thStyle = 'style="padding:6px 8px;font-size:0.75rem;font-weight:bold;border-bottom:2px solid rgba(255,255,255,0.5);color:#ffffff;text-align:left"';

    let t = '<div style="overflow-x:auto;margin:8px 0"><table style="width:100%;border-collapse:collapse"><thead><tr>';
    headerRow.split('|').filter(c => c.trim()).forEach(c => {
      t += `<th ${thStyle}>${c.trim()}</th>`;
    });
    t += '</tr></thead><tbody>';

    dataRows.forEach(row => {
      t += '<tr style="background:rgba(255,255,255,0.05)">';
      row.split('|').filter(c => c.trim()).forEach(c => {
        t += `<td ${cellStyle}>${c.trim()}</td>`;
      });
      t += '</tr>';
    });

    t += '</tbody></table></div>';
    return t;
  });

  html = html.replace(/\n{2,}/g, '</p><p style="font-size:0.875rem;margin:4px 0;color:#ffffff">');
  return `<p style="font-size:0.875rem;margin:4px 0;color:#ffffff">${html}</p>`;
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
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
        )}
      </div>
    </div>
  );
};
