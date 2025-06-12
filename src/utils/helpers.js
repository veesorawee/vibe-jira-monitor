// src/utils/helpers.js

export const parseDate = (dateString) => {
  if (!dateString) return null;
  const parts = dateString.split('-');
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

export const getStatusColor = (status) => {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('cancelled')) return 'bg-green-100 text-green-800 border-green-200';
  if (s.includes('progress') || s.includes('review')) return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

export const isWeekend = (date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

export const formatDate = (date) => {
    if (!date) return null;
    return date instanceof Date ? date.toISOString().split('T')[0] : new Date(date).toISOString().split('T')[0];
};

export const formatDateFull = (date) => date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });

export const formatDateForInput = (date) => {
  if (!date) return '';
  return date.toISOString().split('T')[0];
};

export const formatAssigneeName = (name, email) => {
  if (email && email.includes('@')) {
    const localPart = email.split('@')[0];
    const nameParts = localPart.split('.');
    if (nameParts.length > 1) {
      return `${nameParts[0]}.${nameParts[1].charAt(0)}`;
    }
    return localPart;
  }
  if (!name || name === 'Unassigned') return name;
  const parts = name.split(' ');
  if (parts.length > 1) {
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  }
  return name;
};

const escapeHtml = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

export const adfToHtml = (adf) => {
    if (!adf || !adf.content) return { html: '', slackLink: null, figmaLinks: [] };
    let slackLink = null;
    const figmaLinks = [];
    const renderNode = (node) => {
        let childrenHtml = node.content ? node.content.map(renderNode).join('') : '';
        switch (node.type) {
            case 'doc': return childrenHtml;
            case 'paragraph': return childrenHtml.trim() === '' ? '' : `<p>${childrenHtml}</p>`;
            case 'inlineCard': {
                const url = escapeHtml(node.attrs.url);
                let docType = 'Linked Document', icon = '🔗';
                if (url.includes('docs.google.com/document')) { docType = 'Google Doc'; icon = '📄'; }
                else if (url.includes('docs.google.com/spreadsheets')) { docType = 'Google Sheet'; icon = '📊'; }
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline inline-flex items-center gap-1">${icon} ${docType}</a>`;
            }
            case 'text':
                let text = escapeHtml(node.text || '');
                if (node.marks) {
                    for (const mark of node.marks) {
                        if (mark.type === 'link') {
                            const href = escapeHtml(mark.attrs.href);
                            if (href.includes('lmwn.slack.com')) { if (!slackLink) slackLink = href; return ''; }
                            if (href.includes('figma.com')) {
                                const match = href.match(/\/(?:design|file)\/[^/]+\/([^/?]+)/);
                                let linkText = text || `Figma File #${figmaLinks.length + 1}`;
                                if (match && match[1]) { linkText = decodeURIComponent(match[1]).replace(/[-_]/g, ' '); }
                                figmaLinks.push({ href, text: linkText });
                                return '';
                            }
                            if (href.includes('lmwn-redash.linecorp.com/queries/')) {
                                const match = href.match(/queries\/(\d+)/);
                                const queryId = match ? match[1] : 'unknown';
                                return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">redash #${queryId}</a>`;
                            }
                            return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">${text}</a>`;
                        }
                    }
                }
                return text;
            default: return childrenHtml;
        }
    };
    const html = adf.content.map(renderNode).join('').replace(/<p><\/p>/g, '');
    return { html, slackLink, figmaLinks };
};