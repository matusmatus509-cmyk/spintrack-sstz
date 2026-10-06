/**
 * Mock „fetch" pre testy a offline snapshoty: podáva VERBATIM zachytené
 * stránky portálu (tests/fixtures) podľa routy. Markdown fixture sa prevedie
 * na jednoduché HTML, aby prešiel reálny parser (htmlToAtoms).
 */
import { readFileSync } from 'fs';

export function fixtureToHtml(markdown) {
  const out = [];
  for (const raw of String(markdown).split(/\r?\n/)) {
    if (!raw.trim()) continue;
    let line = raw.replace(/^#{1,6}\s*/, '');
    line = line.replace(
      /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
      (_, text, href) => `<a href="${href}">${text}</a>`
    );
    out.push(`<div>${line}</div>`);
  }
  return out.join('\n');
}

export function loadFixtureHtml(name) {
  const md = readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
  return fixtureToHtml(md);
}

/**
 * @param {Record<string,string>} routes mapa cesta → fixture súbor
 * @param {{emptyHtml?: string}} opts
 */
/**
 * Offline mapa routy → fixture pre hráča 5723 v sezóne 2026/27:
 * verbatím zachytené stránky (2. liga KSTZ Bratislava) + syntetický protokol
 * 1. ligy Západ (zápas 162500), aby sa dal overiť scenár dvoch líg v sezóne.
 */
export const LEAGUE_FIXTURE_ROUTES_5723_2026_27 = {
  '/sezona/2026-27/svk': 'sezona-2026-27-svk.txt',
  '/sezona/2026-27/ba': 'sezona-2026-27-ba.txt',
  '/liga/sezona-2026-27-2-liga-muzi-kstz-bratislava/tabulka': 'tabulka-2liga-2026-27.txt',
  '/liga/sezona-2026-27-2-liga-muzi-kstz-bratislava/uspesnost': 'uspesnost-2liga-2026-27.txt',
  '/liga/sezona-2026-27-2-liga-muzi-kstz-bratislava/uspesnost-stvorhry': 'uspesnost-stvorhry-2liga-2026-27.txt',
  '/liga/sezona-2026-27-2-liga-muzi-kstz-bratislava/rozpis-muzstva?club_id=7959': 'rozpis-muzstva-skst-b-2026-27.txt',
  '/liga/sezona-2026-27-1-liga-zapad-muzi-sstz/tabulka': 'tabulka-1liga-zapad-2026-27.txt',
  '/liga/sezona-2026-27-1-liga-zapad-muzi-sstz/uspesnost': 'uspesnost-1liga-zapad-2026-27.txt',
  '/liga/sezona-2026-27-1-liga-zapad-muzi-sstz/uspesnost-stvorhry': 'uspesnost-stvorhry-1liga-zapad-2026-27.txt',
  '/liga/sezona-2026-27-1-liga-zapad-muzi-sstz/rozpis-muzstva?club_id=8100': 'rozpis-muzstva-1liga-skst-2026-27.txt',
  '/zapas/161962': 'zapas-161962.txt',
  '/zapas/161971': 'zapas-161971.txt',
  '/zapas/161975': 'zapas-161975.txt',
  '/zapas/162500': 'zapas-162500.txt',
};

export function createFixtureFetch(routes, { emptyHtml = '<div>Prázdna stránka</div>' } = {}) {
  const calls = [];
  const impl = async (path) => {
    calls.push(path);
    const file = routes[path];
    return { html: file ? loadFixtureHtml(file) : emptyHtml, status: 200 };
  };
  return { impl, calls };
}
