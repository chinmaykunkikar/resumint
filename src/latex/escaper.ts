const LATEX_SPECIAL_CHARS: Record<string, string> = {
  '&': '\\&',
  '%': '\\%',
  '$': '\\$',
  '#': '\\#',
  '_': '\\_',
  '{': '\\{',
  '}': '\\}',
  '~': '\\textasciitilde{}',
  '^': '\\textasciicircum{}',
}

export function escapeLatex(text: string): string {
  return text
    .replace(/[&%$#_{}~^]/g, (char) => LATEX_SPECIAL_CHARS[char] ?? char)
    .replace(/—/g, '---')
    .replace(/–/g, '--')
    .replace(/'/g, "'")
    .replace(/'/g, "`")
    .replace(/"/g, "''")
    .replace(/"/g, "``")
}

export function escapeUrl(url: string): string {
  // URLs inside \href don't need standard LaTeX escaping
  // but % and # need special handling
  return url.replace(/%/g, '\\%').replace(/#/g, '\\#')
}
