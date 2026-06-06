import { GITHUB_USER } from './scripts/00-config.js';
import { sampleRepos } from './scripts/01-sampleRepos.js';
import {
  fetchRepositoriesWithCommits,
  GitHubRateLimitError,
  readCachedLiveRepos,
  writeCachedLiveRepos,
} from './scripts/02-github.js';
import { createGalaxyLayout, getLanguageSummary } from './scripts/03-galaxyLayout.js';
import {
  bindPanelClose,
  hideLoading,
  showInfoPanel,
  showLoading,
  showNotice,
  updateLegend,
  updateSummary,
} from './scripts/04-ui.js';
import { createGalaxyScene } from './scripts/05-scene.js';

const scene = createGalaxyScene(document.querySelector('#scene-layer'), {
  onSelect: (body) => showInfoPanel(body),
});

bindPanelClose(() => scene.clearSelection());
showLoading({ done: 0, total: 0 });

function renderGalaxy(repos, status, notice) {
  const layout = createGalaxyLayout(repos);
  const totalCommits = repos.reduce((sum, repo) => {
    if (repo.commitCountUnavailable) return sum;
    return sum + (Number.isFinite(repo.commitCount) ? repo.commitCount : 0);
  }, 0);

  scene.setLayout(layout);
  updateSummary({
    repoCount: repos.length,
    systemCount: layout.systems.length,
    commitCount: totalCommits,
  });
  updateLegend(getLanguageSummary(layout));
  showNotice(status, notice);
  hideLoading();
}

async function loadPortfolioGalaxy() {
  const cachedRepos = readCachedLiveRepos();
  if (cachedRepos) {
    renderGalaxy(cachedRepos, 'cached', 'Live GitHub data from local cache');
    return;
  }

  try {
    const liveRepos = await fetchRepositoriesWithCommits(GITHUB_USER, (progress) => {
      showLoading(progress);
    });

    if (!liveRepos.length) {
      renderGalaxy(sampleRepos, 'fallback', 'No public repos found, showing sample data');
      return;
    }

    const missingCommitCounts = liveRepos.filter((repo) => repo.commitCountUnavailable).length;
    writeCachedLiveRepos(liveRepos);
    renderGalaxy(
      liveRepos,
      missingCommitCounts ? 'partial' : 'ready',
      missingCommitCounts
        ? `Live GitHub repos loaded; ${missingCommitCounts} commit counts are rate-limited`
        : 'Live GitHub data',
    );
  } catch (error) {
    const staleCachedRepos = readCachedLiveRepos(Infinity);
    if (staleCachedRepos) {
      renderGalaxy(
        staleCachedRepos,
        'partial',
        'GitHub API rate limit reached, showing cached live GitHub data',
      );
      return;
    }

    renderGalaxy(
      sampleRepos,
      'fallback',
      error instanceof GitHubRateLimitError
        ? 'GitHub API rate limit reached, showing sample data'
        : 'GitHub data unavailable, showing sample data',
    );
  }
}

loadPortfolioGalaxy();
