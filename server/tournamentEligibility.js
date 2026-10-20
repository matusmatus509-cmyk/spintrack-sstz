// Pure rules derived from category metadata and published propositions. No
// tournament titles, IDs, player IDs or a particular season are allowlisted.
const norm = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const seasonEnd = (date) =>
  Number(date.slice(0, 4)) + (Number(date.slice(5, 7)) >= 7 ? 1 : 0);
const standardAge = (label) => {
  const value = norm(label);
  const under = value.match(/\bu\s*[-]?\s*(\d{1,2})\b|do\s+(\d{1,2})\s*rok/);
  if (under) return Number(under[1] || under[2]);
  if (/najmlads.*ziac/.test(value)) return 11;
  if (/mlads.*ziac/.test(value)) return 13;
  if (/stars.*ziac/.test(value)) return 15;
  if (/dorast/.test(value)) return 19;
  return null;
};
export function agePolicy(category, date, rules = "") {
  const label = norm(category.age || category.label || category);
  const published = norm(rules);
  const labels = [...new Set([label, norm(category.label)].filter(Boolean))];
  const contexts = labels
    .map(
      (value) =>
        published.match(new RegExp(`\\b${escape(value)}[^\\n]{0,100}`))?.[0],
    )
    .filter(Boolean);
  const context = label + " " + norm(category.label) + " " + contexts.join(" ");
  const years = context.match(
    /\b((?:19|20)\d{2})\s*(?:az|[-–—])\s*((?:19|20)\d{2})\b/,
  );
  if (years)
    return {
      minimumBirthYear: Math.min(Number(years[1]), Number(years[2])),
      maximumBirthYear: Math.max(Number(years[1]), Number(years[2])),
      known: true,
    };
  const youngest = context.match(/\b((?:19|20)\d{2})\s*(?:a|i)\s*mlad/);
  if (youngest)
    return {
      minimumBirthYear: Number(youngest[1]),
      maximumBirthYear: null,
      known: true,
    };
  const oldest = context.match(/\b((?:19|20)\d{2})\s*(?:a|i)\s*stars/);
  if (oldest)
    return {
      minimumBirthYear: null,
      maximumBirthYear: Number(oldest[1]),
      known: true,
    };
  // Adult/veteran metadata often names the age band (M40-49, Ž 60+)
  // rather than publishing birth years. These are calendar-year age bands.
  const calendarYear = Number(date.slice(0, 4));
  const ageRange = context.match(/(?<!\d)(\d{1,2})\s*[-–—]\s*(\d{1,2})(?!\d)/);
  if (ageRange && !/\bu\s*\d/.test(context)) {
    const from = Number(ageRange[1]),
      to = Number(ageRange[2]);
    if (from > 0 && to >= from)
      return {
        minimumBirthYear: calendarYear - to,
        maximumBirthYear: calendarYear - from,
        known: true,
      };
  }
  const over = context.match(
    /(?<!\d)(\d{1,2})\s*\+|(?:od|nad)\s+(\d{1,2})\s*(?:rok|$)/,
  );
  if (over)
    return {
      minimumBirthYear: null,
      maximumBirthYear: calendarYear - Number(over[1] || over[2]),
      known: true,
    };
  if (
    /bez vekoveho obmedzenia/.test(label) ||
    /bez vekoveho obmedzenia/.test(context)
  )
    return { minimumBirthYear: null, maximumBirthYear: null, known: true };
  const age = standardAge(label);
  if (age && age > 0 && age < 100 && /^\d{4}-\d{2}-\d{2}$/.test(date))
    return {
      minimumBirthYear: seasonEnd(date) - age,
      maximumBirthYear: null,
      known: true,
    };
  return { minimumBirthYear: null, maximumBirthYear: null, known: false };
}
export function minimumYear(category, date, rules = "") {
  return agePolicy({ age: category }, date, rules).minimumBirthYear;
}
const regions = [
  ["BA", "Bratislavský kraj", "bratislavsk"],
  ["TT", "Trnavský kraj", "trnavsk"],
  ["TN", "Trenčiansky kraj", "trenciansk"],
  ["NR", "Nitriansky kraj", "nitriansk"],
  ["ZA", "Žilinský kraj", "zilinsk"],
  ["BB", "Banskobystrický kraj", "banskobystrick"],
  ["PO", "Prešovský kraj", "presovsk"],
  ["KE", "Košický kraj", "kosick"],
];
function regionCodes(value) {
  const normalized = norm(value);
  const found = regions
    .filter(
      ([code, , root]) =>
        new RegExp(`\\b${code.toLowerCase()}\\b`).test(normalized) ||
        normalized.includes(root),
    )
    .map(([code]) => code);
  if (/stredoslovensk/.test(normalized)) found.push("ZA", "BB");
  if (/vychodoslovensk/.test(normalized)) found.push("PO", "KE");
  if (/zapadoslovensk/.test(normalized)) found.push("BA", "TT", "TN", "NR");
  return [...new Set(found)];
}
export function participationPolicy(rules, title) {
  const normalized = norm(rules).replace(/\s+/g, " ");
  // Region restrictions must describe participating players/clubs, not the
  // tournament venue or an organiser's address.
  const regionClauses =
    normalized.match(
      /(?:(?:len|iba|vyhradne)\s+)?(?:turnaj je urceny pre|ucast(?:nit sa)? (?:mozu|je)|pre hracov|hraci|hracov|hracky|klubov)[^.]{0,180}?(?:kraja|krajov|regione|regionu|regionov)\b/g,
    ) || [];
  const allowedRegions = [...new Set(regionClauses.flatMap(regionCodes))];
  const steps = [];
  const youngerParagraph = normalized.match(
    /pre mladsie kategorie(?: ale)? plati,[\s\S]*?vo svojej vekovej kategorii\s*\./,
  )?.[0];
  if (youngerParagraph) {
    for (const match of youngerParagraph.matchAll(
      /o\s+(jednu|dve|\d+)\s+vekov[uey]\s+kategori[ueiy]+\s+vyssie,[\s\S]*?do\s*(\d+)\.\s*miesta/g,
    )) {
      steps.push({
        levels:
          match[1] === "jednu" ? 1 : match[1] === "dve" ? 2 : Number(match[1]),
        place: Number(match[2]),
      });
    }
  }
  let generalRules = steps.length
    ? normalized.replace(youngerParagraph, "")
    : normalized;
  for (const clause of regionClauses) {
    if (regionCodes(clause).length)
      generalRules = generalRules.replace(clause, "");
  }
  return {
    allowedRegions,
    steps,
    // Only remove clauses we understood; unrelated ranking/nomination limits
    // remain subject to the conservative checks in the recommendation service.
    generalRules,
    publicParticipation:
      /turnaja sa mozu zucastnit (?:len )?hraci s platnym registracnym preukazom|ucast (?:je )?(?:otvorena|bez obmedzeni)/.test(
        normalized,
      ),
    regionalTitle:
      /krajsk|regionu|oblastn|orav|stredoslovensk|vychodoslovensk|\bsbtm\b|\bvspm\b/.test(
        norm(title),
      ),
    foreignRanking: /hraci s cudzou statnou prislusnostou/.test(normalized),
  };
}
export function categoryParticipation(
  category,
  player,
  allCategories,
  event,
  rules,
  policy,
) {
  const age = agePolicy(category, event.date, rules);
  if (age.minimumBirthYear !== null && player.birthYear < age.minimumBirthYear)
    return null;
  if (age.maximumBirthYear !== null && player.birthYear > age.maximumBirthYear)
    return null;
  const conditions = [];
  if (!age.known)
    conditions.push(
      "Vekové podmienky tejto kategórie sa nepodarilo jednoznačne prečítať. Over si ich v propozíciách.",
    );
  const playerRegions = regionCodes(player.region);
  if (policy.allowedRegions.length) {
    if (
      playerRegions.length &&
      !playerRegions.some((code) => policy.allowedRegions.includes(code))
    )
      return null;
    if (!playerRegions.length)
      conditions.push(
        `Účasť je pre hráčov klubov: ${regions
          .filter(([code]) => policy.allowedRegions.includes(code))
          .map(([code, name]) => `${name} (${code})`)
          .join(", ")}. Over si kraj svojho klubu.`,
      );
  }
  if (
    policy.regionalTitle &&
    !policy.allowedRegions.length &&
    !/\bopen\b/.test(norm(event.title))
  )
    conditions.push(
      "Over regionálnu príslušnosť svojho klubu podľa propozícií turnaja.",
    );
  if (
    !policy.allowedRegions.length &&
    !policy.publicParticipation &&
    !/\bopen\b/.test(norm(event.title))
  )
    conditions.push(
      "Pred prihlásením over ďalšie podmienky účasti v propozíciách turnaja.",
    );
  if (policy.steps.length && age.minimumBirthYear !== null) {
    // Standard bands plus additional bands actually published by this event.
    const bands = [
      ...new Set(
        [11, 13, 15, 19]
          .map((under) => seasonEnd(event.date) - under)
          .concat(
            allCategories.map(
              (c) => agePolicy(c, event.date, rules).minimumBirthYear,
            ),
          )
          .filter((year) => year !== null),
      ),
    ].sort((a, b) => a - b);
    const target = bands.indexOf(age.minimumBirthYear);
    const own = bands.findLastIndex((year) => player.birthYear >= year);
    const levels = own - target;
    if (levels > 0) {
      const step = policy.steps.find((rule) => rule.levels === levels);
      if (!step) return null;
      const scope = policy.allowedRegions.length
        ? ` medzi hráčmi ${policy.allowedRegions.join(" + ")}`
        : "";
      conditions.push(
        `Ako mladší hráč potrebuješ byť do ${step.place}. miesta${scope} v SR rebríčku svojej vekovej kategórie.`,
      );
    }
  }
  if (policy.foreignRanking)
    conditions.push(
      "Hráči s cudzou štátnou príslušnosťou potrebujú zaradenie do SR rebríčka príslušnej kategórie.",
    );
  return {
    ...age,
    conditions,
    eligibility: conditions.length ? "conditional" : "verified",
  };
}

// Explicit category sections can carry different participation rules. Shared
// introductory rules still apply; another category's restrictions do not.
export function rulesForCategory(category, categories, rules) {
  const lines = String(rules).split("\n");
  const headings = [];
  for (let index = 0; index < lines.length; index++) {
    const line = norm(lines[index]).trim();
    for (const candidate of categories) {
      const names = [
        ...new Set([candidate.label, candidate.age].filter(Boolean).map(norm)),
      ];
      if (
        names.some((name) =>
          new RegExp(`^(?:kategoria\\s+)?${escape(name)}(?:\\s*:|\\s*$)`).test(
            line,
          ),
        )
      ) {
        headings.push({ index, label: candidate.label });
        break;
      }
    }
  }
  const match = headings.findIndex(
    (heading) => heading.label === category.label,
  );
  if (headings.length < 2 || match < 0) return rules;
  const commonFooter = lines.findIndex(
    (line, index) =>
      index > headings.at(-1).index &&
      /^(?:vseobecne|spolocne) (?:podmienky|ustanovenia)\s*:?\s*$/.test(
        norm(line).trim(),
      ),
  );
  return [
    ...lines.slice(0, headings[0].index),
    ...lines.slice(
      headings[match].index,
      headings[match + 1]?.index ??
        (commonFooter >= 0 ? commonFooter : lines.length),
    ),
    ...(commonFooter >= 0 ? lines.slice(commonFooter) : []),
  ].join("\n");
}
