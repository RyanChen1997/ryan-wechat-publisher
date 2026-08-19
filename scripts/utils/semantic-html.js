function stripInlineMarkdown(text) {
  return String(text || '')
    .replace(/!\[\[(.*?)\]\]/g, '')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '')
    .replace(/\[\[(.*?)\]\]/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1（$2）')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function escapeHtmlAttribute(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function semanticAttributes(text, role) {
  return `data-semantic-role="${escapeHtmlAttribute(role)}" data-semantic-text="${escapeHtmlAttribute(stripInlineMarkdown(text))}"`;
}

module.exports = { stripInlineMarkdown, escapeHtmlAttribute, semanticAttributes };
