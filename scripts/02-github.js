import {
  API_ROOT,
  LIVE_CACHE_KEY,
  LIVE_CACHE_TTL_MS,
  PARTIAL_CACHE_TTL_MS,
} from './00-config.js';

export class GitHubRateLimitError extends Error {
  constructor(message = 'GitHub API rate limit reached') {
    super(message);
    this.name = 'GitHubRateLimitError';
  }
}

async function githubFetch(path) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  const remaining = response.headers.get('X-RateLimit-Remaining');
  if ((response.status === 403 || response.status === 429) && remaining === '0') {
    throw new GitHubRateLimitError();
  }

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText}`);
  }

  return {
    data: await response.json(),
    headers: response.headers,
  };
}

function parseNextPage(linkHeader) {
  if (!linkHeader) return null;
  const nextLink = linkHeader
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.endsWith('rel="next"'));

  if (!nextLink) return null;
  const url = nextLink.match(/<([^>]+)>/)?.[1];
  return url ? url.replace(API_ROOT, '') : null;
}

function parseLastPage(linkHeader) {
  if (!linkHeader) return null;
  const lastLink = linkHeader
    .split(',')
    .map((entry) => entry.trim())
    .find((entry) => entry.endsWith('rel="last"'));

  const url = lastLink?.match(/<([^>]+)>/)?.[1];
  const page = url ? new URL(url).searchParams.get('page') : null;
  return page ? Number(page) : null;
}

async function getAllPages(path) {
  const items = [];
  let nextPath = path;

  while (nextPath) {
    const { data, headers } = await githubFetch(nextPath);
    items.push(...data);
    nextPath = parseNextPage(headers.get('Link'));
  }

  return items;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );

  return results;
}

async function getCommitCount(repo) {
  if (!repo.default_branch) return { count: 0, unavailable: false };

  try {
    const { data, headers } = await githubFetch(
      `/repos/${repo.owner.login}/${repo.name}/commits?per_page=1&sha=${encodeURIComponent(
        repo.default_branch,
      )}`,
    );

    const lastPage = parseLastPage(headers.get('Link'));
    return {
      count: lastPage ?? (Array.isArray(data) ? data.length : 0),
      unavailable: false,
    };
  } catch (error) {
    return {
      count: 0,
      unavailable: error instanceof GitHubRateLimitError,
    };
  }
}

export function readCachedLiveRepos(maxAgeMs = LIVE_CACHE_TTL_MS) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(LIVE_CACHE_KEY) || 'null');
    if (!cached?.repos?.length || !cached.timestamp) return null;

    if (maxAgeMs !== Infinity) {
      const cacheTtl = cached.complete
        ? maxAgeMs
        : Math.min(maxAgeMs, PARTIAL_CACHE_TTL_MS);
      if (Date.now() - cached.timestamp > cacheTtl) return null;
    }

    return cached.repos;
  } catch {
    return null;
  }
}

export function writeCachedLiveRepos(repos) {
  try {
    window.localStorage.setItem(
      LIVE_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        complete: repos.every((repo) => !repo.commitCountUnavailable),
        repos,
      }),
    );
  } catch {
    // Local storage is only a rate-limit guard; the static site still works without it.
  }
}

export async function fetchRepositoriesWithCommits(username, onProgress) {
  // GitHub fetching: public repositories come from the REST users/repos endpoint.
  // GitHub does not include total commits in that response, so each repo is
  // enriched with one commits request that reads the final pagination page.
  const repos = await getAllPages(
    `/users/${username}/repos?type=public&sort=updated&per_page=100`,
  );

  onProgress?.({ phase: 'repos', done: 0, total: repos.length });

  let completed = 0;
  let commitRequestsRateLimited = false;
  const enriched = await mapWithConcurrency(repos, 4, async (repo) => {
    const commitResult = commitRequestsRateLimited
      ? { count: 0, unavailable: true }
      : await getCommitCount(repo);

    if (commitResult.unavailable) {
      commitRequestsRateLimited = true;
    }

    completed += 1;
    onProgress?.({ phase: 'commits', done: completed, total: repos.length });

    return {
      id: repo.id,
      name: repo.name,
      description: repo.description,
      primaryLanguage: repo.language || 'Unknown',
      commitCount: commitResult.count,
      commitCountUnavailable: commitResult.unavailable,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.updated_at,
      githubUrl: repo.html_url,
    };
  });

  return enriched.filter((repo) => !repo.githubUrl.endsWith('/.github'));
}
