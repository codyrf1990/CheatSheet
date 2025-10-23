const DEFAULT_SEARCH_LIMIT = 5;
const DEFAULT_IMPORTANCE = 1;
const BM25_K1 = 1.5;
const BM25_B = 0.75;

const EPSILON = 1e-9;

export class ChatbotRagEngine {
  constructor(options = {}) {
    this.limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : DEFAULT_SEARCH_LIMIT;
    this.documents = [];
    this.index = [];
    this.docCount = 0;
    this.avgDocLength = 0;
    this.docFrequencies = new Map();
  }

  reset(documents = []) {
    this.documents = Array.isArray(documents) ? documents : [];
    const index = [];
    const docFreq = new Map();
    let totalLength = 0;

    this.documents.forEach((doc, idx) => {
      const tokens = tokenize(doc.content || '');
      const length = tokens.length;
      const frequencies = new Map();
      tokens.forEach(token => {
        frequencies.set(token, (frequencies.get(token) || 0) + 1);
      });

      if (length) {
        const uniqueTokens = frequencies.keys();
        for (const token of uniqueTokens) {
          docFreq.set(token, (docFreq.get(token) || 0) + 1);
        }
      }

      totalLength += length;
      index.push({
        id: idx,
        length,
        frequencies,
        importance: normalizeImportance(doc.importance)
      });
    });

    this.index = index;
    this.docCount = index.length;
    this.avgDocLength = this.docCount ? totalLength / this.docCount : 0;
    this.docFrequencies = docFreq;
  }

  ingest(snapshot = {}) {
    const fromPackages = extractFromPackages(snapshot.packages || []);
    const fromSelections = extractFromSelections(snapshot.selections || {});
    const fromTemplates = extractFromTemplates(snapshot.templates || {});
    this.reset([...fromPackages, ...fromSelections, ...fromTemplates]);
  }

  search(query) {
    if (!query || !this.documents.length) return [];
    const queryTokens = tokenize(query);
    if (!queryTokens.length) return [];

     const queryTermCounts = buildTermFrequencyMap(queryTokens);

    return this.index
      .map(entry => {
        const matchScore = scoreEntryBM25({
          queryTermCounts,
          entry,
          docFrequencies: this.docFrequencies,
          docCount: this.docCount,
          avgDocLength: this.avgDocLength
        });
        if (matchScore <= 0) {
          return null;
        }
        return {
          document: this.documents[entry.id],
          score: matchScore * entry.importance
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.limit);
  }
}

function extractFromPackages(packages = []) {
  return packages.map(pkg => {
    const bits = [
      ...(pkg.looseBits || []),
      ...flattenGroups(pkg.masterGroups || [])
    ];
    return {
      title: pkg.code || 'Package',
      content: [pkg.description || '', bits.join(', ')].filter(Boolean).join('\n'),
      importance: 1.4
    };
  });
}

function extractFromSelections(selections = {}) {
  const packages = selections.packages || [];
  if (!packages.length) return [];

  const docs = packages.map(pkg => {
    const lines = [];
    if (pkg.notes?.length) {
      lines.push(`General notes: ${pkg.notes.join(', ')}`);
    }
    if (pkg.looseBits?.length) {
      lines.push(`Loose bits: ${pkg.looseBits.join(', ')}`);
    }
    if (pkg.masterGroups?.length) {
      pkg.masterGroups.forEach(group => {
        if (group.items?.length) {
          lines.push(`${group.label}: ${group.items.join(', ')}`);
        } else {
          lines.push(`${group.label}: entire group selected`);
        }
      });
    }
    const header = pkg.name ? `${pkg.code} – ${pkg.name}` : pkg.code;
    return {
      title: `Selected Package ${header}`,
      content: lines.join('\n') || 'No specific options recorded.',
      importance: 1.5
    };
  });

  docs.push({
    title: 'Package Selection Summary',
    content: `Packages selected (${packages.length}): ${packages.map(pkg => pkg.code).join(', ')}. Total checked options: ${selections.totalChecked || 0}.`,
    importance: 1.1
  });

  return docs;
}

function extractFromTemplates(templates = {}) {
  if (!templates.activeId) return [];
  return [
    {
      title: 'Active Template',
      content: `Active template ID: ${templates.activeId}`,
      importance: 1.1
    }
  ];
}

function flattenGroups(groups) {
  return groups.flatMap(group => group.items || []);
}

function tokenize(value) {
  if (!value) return [];
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeImportance(rawImportance) {
  if (typeof rawImportance === 'number' && Number.isFinite(rawImportance) && rawImportance > 0) {
    return rawImportance;
  }
  return DEFAULT_IMPORTANCE;
}

function buildTermFrequencyMap(tokens) {
  const frequencies = new Map();
  tokens.forEach(token => {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  });
  return frequencies;
}

function scoreEntryBM25({ queryTermCounts, entry, docFrequencies, docCount, avgDocLength }) {
  if (!entry || !entry.length || !entry.frequencies || !docCount) {
    return 0;
  }

  let score = 0;
  const lengthRatio = entry.length && avgDocLength ? entry.length / avgDocLength : 0;

  for (const [token, queryFrequency] of queryTermCounts.entries()) {
    const termFrequency = entry.frequencies.get(token);
    if (!termFrequency) {
      continue;
    }

    const documentFrequency = docFrequencies.get(token) || 0;
    if (!documentFrequency) {
      continue;
    }

    const idfNumerator = docCount - documentFrequency + 0.5;
    const idfDenominator = documentFrequency + 0.5;
    const idf = Math.log((idfNumerator / (idfDenominator + EPSILON)) + 1);

    const tfComponentNumerator = termFrequency * (BM25_K1 + 1);
    const tfComponentDenominator =
      termFrequency +
      BM25_K1 * (1 - BM25_B + BM25_B * lengthRatio);

    if (!tfComponentDenominator) {
      continue;
    }

    const termScore = idf * (tfComponentNumerator / tfComponentDenominator);

    // Weight by query frequency (standard BM25 uses k3 term; using linear scaling is sufficient here)
    score += termScore * (1 + Math.log(1 + queryFrequency));
  }

  return score;
}
