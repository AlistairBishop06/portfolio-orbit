const LANGUAGE_THEMES = {
  JavaScript: '#f7df1e',
  TypeScript: '#67a7ff',
  HTML: '#ff7a59',
  CSS: '#7b8cff',
  SCSS: '#ff7ecb',
  Python: '#5be6a8',
  'Jupyter Notebook': '#ffad45',
  Java: '#ffbf69',
  Kotlin: '#c69cff',
  Scala: '#ff6b6b',
  C: '#9fc7ff',
  'C++': '#7ed9ff',
  'C#': '#b48cff',
  Rust: '#ff9b6a',
  Go: '#69e6f0',
  Shell: '#d4f77c',
  PowerShell: '#7cd8ff',
  Ruby: '#ff6f8f',
  PHP: '#b6a2ff',
  Swift: '#ff9566',
  Dart: '#73d7ff',
  Vue: '#55e6ad',
  Svelte: '#ff815f',
  Unknown: '#c7ced8',
};

const LANGUAGE_CLUSTERS = {
  web: ['JavaScript', 'TypeScript', 'HTML', 'CSS', 'SCSS', 'Vue', 'Svelte'],
  python: ['Python', 'Jupyter Notebook'],
  systems: ['C', 'C++', 'C#', 'Rust', 'Go', 'Shell', 'PowerShell'],
  jvm: ['Java', 'Kotlin', 'Scala'],
  app: ['Swift', 'Dart'],
  data: ['R', 'SQL'],
  server: ['Ruby', 'PHP'],
  neutral: ['Unknown'],
};

const CLUSTER_ORDER = ['web', 'python', 'systems', 'jvm', 'app', 'server', 'data', 'neutral'];
const TAU = Math.PI * 2;

function getCluster(language) {
  return (
    Object.entries(LANGUAGE_CLUSTERS).find(([, languages]) =>
      languages.includes(language),
    )?.[0] ?? 'neutral'
  );
}

function getLanguageColor(language) {
  return LANGUAGE_THEMES[language] ?? '#d4d9e2';
}

function normaliseLog(value, min, max) {
  if (max <= min) return 0.55;
  const safeValue = Math.max(0, value);
  const logMin = Math.log1p(Math.max(0, min));
  const logMax = Math.log1p(Math.max(0, max));

  // Commit count normalisation: log scaling keeps one very active repository
  // from flattening the rest of the galaxy, while still making higher-commit
  // projects larger, brighter, and closer to their language star.
  return (Math.log1p(safeValue) - logMin) / (logMax - logMin);
}

function groupByLanguage(repos) {
  return repos.reduce((groups, repo) => {
    const language = repo.primaryLanguage || 'Unknown';
    groups.set(language, [...(groups.get(language) ?? []), repo]);
    return groups;
  }, new Map());
}

function languageSort(a, b) {
  const clusterA = getCluster(a[0]);
  const clusterB = getCluster(b[0]);
  const clusterDelta = CLUSTER_ORDER.indexOf(clusterA) - CLUSTER_ORDER.indexOf(clusterB);
  return clusterDelta || a[0].localeCompare(b[0]);
}

function getKnownCommitCount(repo) {
  return Number.isFinite(repo.commitCount) && !repo.commitCountUnavailable ? repo.commitCount : 0;
}

export function createGalaxyLayout(repos) {
  // Language grouping: every primary language becomes its own solar system.
  // The most committed repo anchors that system as the star, and all remaining
  // repos become orbiting planets around it.
  const languageGroups = [...groupByLanguage(repos).entries()].sort(languageSort);
  const clusterCounts = new Map();
  const systems = [];
  const bodies = [];

  for (const [language, languageRepos] of languageGroups) {
    const cluster = getCluster(language);
    const clusterIndex = CLUSTER_ORDER.indexOf(cluster);
    const localIndex = clusterCounts.get(cluster) ?? 0;
    clusterCounts.set(cluster, localIndex + 1);

    const sortedRepos = [...languageRepos].sort(
      (a, b) => getKnownCommitCount(b) - getKnownCommitCount(a),
    );
    const starRepo = sortedRepos[0];
    const planets = sortedRepos.slice(1);
    const commitValues = sortedRepos.map(getKnownCommitCount);
    const minCommits = Math.min(...commitValues);
    const maxCommits = Math.max(...commitValues);
    const color = getLanguageColor(language);

    // Star/planet/orbit placement logic: related languages share a cluster
    // angle, then spread only slightly around it. Unknown languages are pushed
    // into the neutral outer ring so they read as a separate fallback system.
    const clusterAngle = (clusterIndex / CLUSTER_ORDER.length) * TAU;
    const angle = clusterAngle + (localIndex - 0.5) * 1.15;
    const distance =
      cluster === 'neutral'
        ? 122 + localIndex * 22
        : 58 + clusterIndex * 7 + localIndex * 26;
    const position = [
      Number((Math.cos(angle) * distance).toFixed(3)),
      Number((((localIndex % 3) - 1) * 9).toFixed(3)),
      Number((Math.sin(angle) * distance).toFixed(3)),
    ];

    const starNormalised = normaliseLog(getKnownCommitCount(starRepo), minCommits, maxCommits);
    const starBody = {
      id: `${starRepo.id}-star`,
      kind: 'star',
      repo: starRepo,
      language,
      cluster,
      color,
      systemPosition: position,
      position: [0, 0, 0],
      size: 1.25 + starNormalised * 0.95 + Math.min(planets.length, 5) * 0.08,
      brightness: 2.1 + starNormalised * 1.2,
      normalisedCommits: starNormalised,
    };

    const planetBodies = planets.map((repo, index) => {
      const normalised = normaliseLog(getKnownCommitCount(repo), minCommits, maxCommits);
      const orbitBand = index * 4.2;
      const orbitRadius = 11 + (1 - normalised) * 17 + orbitBand;

      return {
        id: `${repo.id}-planet`,
        kind: 'planet',
        repo,
        language,
        cluster,
        color,
        systemPosition: position,
        orbitRadius,
        initialAngle: (index / Math.max(planets.length, 1)) * TAU + localIndex * 0.9,
        tilt: ((index % 5) - 2) * 0.11,
        phase: localIndex * 0.21,
        speed: 0.045 + (1 - normalised) * 0.018 + index * 0.004,
        size: 0.42 + normalised * 0.82,
        brightness: 0.8 + normalised * 1.35,
        normalisedCommits: normalised,
      };
    });

    const system = {
      id: language,
      language,
      cluster,
      color,
      position,
      star: starBody,
      planets: planetBodies,
    };

    systems.push(system);
    bodies.push(starBody, ...planetBodies);
  }

  return { systems, bodies };
}

export function getLanguageSummary(layout) {
  return layout.systems.map((system) => ({
    language: system.language,
    color: system.color,
    count: 1 + system.planets.length,
  }));
}
