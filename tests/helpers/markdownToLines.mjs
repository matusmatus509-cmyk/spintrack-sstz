/**
 * Prevod "markdownového" textu stránky (tak, ako ho vracia web/čítací nástroj)
 * na rovnaké atómy a riadky, aké vytvára `htmlToAtoms` + `atomsToLines`.
 * Slúži výhradne na testy parsera nad reálnymi zachytenými stránkami.
 */
import { readFileSync } from 'fs';

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function markdownToAtoms(text) {
  const atoms = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/^#{1,6}\s*/, '').trim();
    if (!line) {
      atoms.push({ type: 'break' });
      continue;
    }
    let cursor = 0;
    let match;
    MARKDOWN_LINK.lastIndex = 0;
    const pieces = [];
    while ((match = MARKDOWN_LINK.exec(line)) !== null) {
      if (match.index > cursor) pieces.push({ kind: 'text', value: line.slice(cursor, match.index) });
      pieces.push({ kind: 'link', href: match[2], text: match[1].trim() });
      cursor = MARKDOWN_LINK.lastIndex;
    }
    if (cursor < line.length) pieces.push({ kind: 'text', value: line.slice(cursor) });

    for (const piece of pieces) {
      if (piece.kind === 'link') {
        atoms.push({ type: 'link', href: piece.href, text: piece.text });
      } else {
        for (const token of piece.value.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)) {
          if (/^[+-]\d{1,3}$/.test(token)) {
            atoms.push({ type: 'signed', raw: token, value: parseInt(token.slice(1), 10), win: token[0] === '+' });
          } else if (/^\d{1,3}$/.test(token)) {
            atoms.push({ type: 'num', raw: token, value: parseInt(token, 10) });
          } else {
            atoms.push({ type: 'text', text: token });
          }
        }
      }
    }
    atoms.push({ type: 'break' });
  }
  return atoms;
}

export function loadFixtureLines(name) {
  const url = new URL(`../fixtures/${name}`, import.meta.url);
  const text = readFileSync(url, 'utf8');
  // rovnaká logika delenia riadkov ako v scraperi
  const atoms = markdownToAtoms(text);
  const lines = [];
  let current = [];
  const flush = () => {
    if (!current.length) return;
    const links = current.filter((a) => a.type === 'link');
    const text = current
      .map((a) => (a.type === 'link' ? a.text : a.raw || a.text || ''))
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    lines.push({
      atoms: current,
      text,
      links,
      nums: current.filter((a) => a.type === 'num'),
      signed: current.filter((a) => a.type === 'signed'),
      attrs: [],
    });
    current = [];
  };
  for (const atom of atoms) {
    if (atom.type === 'break') flush();
    else current.push(atom);
  }
  flush();
  return lines;
}
