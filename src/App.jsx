import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Code2,
  ExternalLink,
  GitBranch,
  GitFork,
  LoaderCircle,
  Star,
  X,
} from 'lucide-react';
import GalaxyScene from './components/GalaxyScene.jsx';
import { fetchRepositoriesWithCommits, GITHUB_USER, GitHubRateLimitError } from './api/github.js';
import { sampleRepos } from './data/sampleRepos.js';
import { createGalaxyLayout, getLanguageSummary } from './utils/galaxy.js';

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function LoadingOverlay({ progress }) {
  const hasProgress = progress.total > 0;

  return (
    <div className="loading-overlay" role="status" aria-live="polite">
      <LoaderCircle className="loading-spinner" aria-hidden="true" />
      <span>Fetching public GitHub repositories</span>
      <strong>
        {hasProgress
          ? `Mapping commit counts ${progress.done}/${progress.total}`
          : 'Building constellation'}
      </strong>
    </div>
  );
}

function InfoPanel({ body, onClose }) {
  if (!body) return null;

  const { repo, kind, language } = body;
  const stats = [
    { label: 'Commits', value: repo.commitCount, icon: Activity },
    { label: 'Stars', value: repo.stars, icon: Star },
    { label: 'Forks', value: repo.forks, icon: GitFork },
    { label: 'Updated', value: formatDate(repo.updatedAt), icon: CalendarDays },
  ];

  return (
    <aside className="info-panel" aria-label={`${repo.name} repository details`}>
      <button className="icon-button panel-close" type="button" onClick={onClose} aria-label="Close panel">
        <X size={18} aria-hidden="true" />
      </button>
      <p className="panel-kicker">{kind === 'star' ? 'Central star' : 'Orbiting planet'}</p>
      <h2>{repo.name}</h2>
      <p className="panel-description">{repo.description || 'No description provided.'}</p>

      <div className="language-pill">
        <Code2 size={16} aria-hidden="true" />
        <span>{language}</span>
      </div>

      <dl className="repo-stats">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="repo-stat">
            <dt>
              <Icon size={16} aria-hidden="true" />
              {label}
            </dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <a className="github-link" href={repo.githubUrl} target="_blank" rel="noreferrer">
        <GitBranch size={18} aria-hidden="true" />
        Open on GitHub
        <ExternalLink size={15} aria-hidden="true" />
      </a>
    </aside>
  );
}

function LanguageLegend({ languages }) {
  if (!languages.length) return null;

  return (
    <div className="language-legend" aria-label="Repository languages">
      {languages.map((item) => (
        <span key={item.language} className="legend-item">
          <span className="legend-swatch" style={{ background: item.color }} />
          {item.language}
          <strong>{item.count}</strong>
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [repos, setRepos] = useState([]);
  const [selectedBody, setSelectedBody] = useState(null);
  const [status, setStatus] = useState('loading');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState({ phase: 'repos', done: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;

    async function loadGitHubRepos() {
      setStatus('loading');

      try {
        const liveRepos = await fetchRepositoriesWithCommits(GITHUB_USER, (nextProgress) => {
          if (!cancelled) setProgress(nextProgress);
        });

        if (cancelled) return;
        setRepos(liveRepos.length ? liveRepos : sampleRepos);
        setStatus(liveRepos.length ? 'ready' : 'fallback');
        setNotice(liveRepos.length ? 'Live GitHub data' : 'No public repos found, showing sample data');
      } catch (error) {
        if (cancelled) return;
        setRepos(sampleRepos);
        setStatus('fallback');
        setNotice(
          error instanceof GitHubRateLimitError
            ? 'GitHub API rate limit reached, showing sample data'
            : 'GitHub data unavailable, showing sample data',
        );
      }
    }

    loadGitHubRepos();

    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(() => createGalaxyLayout(repos), [repos]);
  const languages = useMemo(() => getLanguageSummary(layout), [layout]);
  const activeBody = useMemo(() => {
    if (!selectedBody) return null;
    return layout.bodies.find((body) => body.repo.id === selectedBody.repo.id) ?? selectedBody;
  }, [layout.bodies, selectedBody]);

  const totalCommits = repos.reduce((sum, repo) => sum + repo.commitCount, 0);
  const selectedRepoId = activeBody?.repo.id ?? null;

  return (
    <main className="app-shell">
      <div className="scene-layer" aria-hidden={status === 'loading' && repos.length === 0}>
        <GalaxyScene layout={layout} selectedRepoId={selectedRepoId} onSelect={setSelectedBody} />
      </div>

      <header className="top-bar">
        <a className="brand" href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer">
          <span className="brand-mark">O</span>
          <span>
            Orbit
            <small>GitHub portfolio galaxy</small>
          </span>
        </a>
        <a className="header-link" href={`https://github.com/${GITHUB_USER}`} target="_blank" rel="noreferrer">
          <GitBranch size={18} aria-hidden="true" />
          AlistairBishop06
        </a>
      </header>

      <section className="hero-copy" aria-label="Portfolio introduction">
        <p className="eyebrow">Public repositories visualised in 3D</p>
        <h1>Orbit</h1>
        <p>
          A cinematic portfolio map where each language forms a solar system and each repository
          becomes a luminous body shaped by its commit history.
        </p>
        <div className="summary-strip">
          <span>
            <strong>{repos.length}</strong>
            repos
          </span>
          <span>
            <strong>{layout.systems.length}</strong>
            systems
          </span>
          <span>
            <strong>{totalCommits.toLocaleString()}</strong>
            commits
          </span>
        </div>
      </section>

      {status === 'fallback' && (
        <div className="data-notice" role="note">
          <AlertTriangle size={16} aria-hidden="true" />
          {notice}
        </div>
      )}

      {status === 'ready' && <div className="data-source">{notice}</div>}

      <LanguageLegend languages={languages} />
      <InfoPanel body={activeBody} onClose={() => setSelectedBody(null)} />
      {status === 'loading' && <LoadingOverlay progress={progress} />}
    </main>
  );
}
