const API_ROOT = 'https://api.github.com';

export const GITHUB_USER = 'AlistairBishop06';

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
  if (!repo.default_branch) return 0;

  try {
    const { data, headers } = await githubFetch(
      `/repos/${repo.owner.login}/${repo.name}/commits?per_page=1&sha=${encodeURIComponent(
        repo.default_branch,
      )}`,
    );

    const lastPage = parseLastPage(headers.get('Link'));
    return lastPage ?? (Array.isArray(data) ? data.length : 0);
  } catch (error) {
    if (error instanceof GitHubRateLimitError) throw error;

    return 0;
  }
}

export async function fetchRepositoriesWithCommits(username = GITHUB_USER, onProgress) {
  // GitHub fetching: repos come from the public REST users/repos endpoint, then
  // each repository is enriched with a separate commits request because the
  // repository list response does not include a total commit count.
  const repos = await getAllPages(
    `/users/${username}/repos?type=public&sort=updated&per_page=100`,
  );

  onProgress?.({ phase: 'repos', done: 0, total: repos.length });

  let completed = 0;
  const enriched = await mapWithConcurrency(repos, 4, async (repo) => {
    const commitCount = await getCommitCount(repo);
    completed += 1;
    onProgress?.({ phase: 'commits', done: completed, total: repos.length });

    return {
      id: repo.id,
      name: repo.name,
      description: repo.description,
      primaryLanguage: repo.language || 'Unknown',
      commitCount,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      updatedAt: repo.updated_at,
      githubUrl: repo.html_url,
    };
  });

  return enriched.filter((repo) => !repo.githubUrl.endsWith('/.github'));
}
