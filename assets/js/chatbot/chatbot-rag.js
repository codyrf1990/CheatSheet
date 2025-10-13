const DEFAULT_SEARCH_LIMIT = 5;
const DEFAULT_IMPORTANCE = 1;

export class ChatbotRagEngine {
  constructor(options = {}) {
    this.limit = Number.isFinite(options.limit) ? Math.max(1, options.limit) : DEFAULT_SEARCH_LIMIT;
    this.documents = [];
    this.index = [];
  }

  reset(documents = []) {
    this.documents = Array.isArray(documents) ? documents : [];
    this.index = this.documents.map((doc, idx) => ({
      id: idx,
      tokens: tokenize(doc.content || ''),
      importance: doc.importance || DEFAULT_IMPORTANCE
    }));
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

    return this.index
      .map(entry => {
        const matchScore = scoreTokens(queryTokens, entry.tokens);
        if (matchScore <= 0) return null;
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

function scoreTokens(queryTokens, docTokens) {
  if (!docTokens.length) return 0;
  const docSet = new Set(docTokens);
  let matches = 0;
  queryTokens.forEach(token => {
    if (docSet.has(token)) {
      matches += 1;
    }
  });
  return matches / queryTokens.length;
}
