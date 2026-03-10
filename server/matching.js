export function normalizeProjectName(input) {
  if (!input) return "";

  return String(input)
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input) {
  return normalizeProjectName(input)
    .split(" ")
    .filter(Boolean);
}

export function scoreNameMatch(a, b) {
  const na = normalizeProjectName(a);
  const nb = normalizeProjectName(b);

  if (!na || !nb) return 0;

  if (na === nb) return 1;

  if (na.includes(nb) || nb.includes(na)) {
    return 0.9;
  }

  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));

  if (!aTokens.size || !bTokens.size) return 0;

  let overlap = 0;

  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }

  const union = new Set([...aTokens, ...bTokens]).size;

  return union ? overlap / union : 0;
}

export function findBestMatch(targetName, candidates, threshold = 0.6) {
  let best = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateName =
      typeof candidate === "string"
        ? candidate
        : candidate.name || candidate.cardName;

    const score = scoreNameMatch(targetName, candidateName);

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  if (!best || bestScore < threshold) {
    return { match: null, score: bestScore };
  }

  return { match: best, score: bestScore };
}