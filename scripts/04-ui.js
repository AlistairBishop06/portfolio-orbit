const elements = {
  repoCount: document.querySelector('#repo-count'),
  systemCount: document.querySelector('#system-count'),
  commitCount: document.querySelector('#commit-count'),
  loadingOverlay: document.querySelector('#loading-overlay'),
  loadingProgress: document.querySelector('#loading-progress'),
  dataNotice: document.querySelector('#data-notice'),
  dataSource: document.querySelector('#data-source'),
  languageLegend: document.querySelector('#language-legend'),
  panel: document.querySelector('#info-panel'),
  panelClose: document.querySelector('#panel-close'),
  panelKicker: document.querySelector('#panel-kicker'),
  panelTitle: document.querySelector('#panel-title'),
  panelDescription: document.querySelector('#panel-description'),
  panelLanguage: document.querySelector('#panel-language'),
  panelStats: document.querySelector('#panel-stats'),
  panelLink: document.querySelector('#panel-link'),
};

function formatDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function numberOrText(value) {
  return typeof value === 'number' ? value.toLocaleString() : value;
}

function statTemplate(label, value, iconPath) {
  return `
    <div class="repo-stat">
      <dt>
        <svg aria-hidden="true" viewBox="0 0 24 24">${iconPath}</svg>
        ${label}
      </dt>
      <dd>${numberOrText(value)}</dd>
    </div>
  `;
}

export function bindPanelClose(onClose) {
  elements.panelClose.addEventListener('click', () => {
    elements.panel.classList.add('hidden');
    onClose?.();
  });
}

export function updateSummary({ repoCount, systemCount, commitCount }) {
  elements.repoCount.textContent = repoCount.toLocaleString();
  elements.systemCount.textContent = systemCount.toLocaleString();
  elements.commitCount.textContent = commitCount.toLocaleString();
}

export function updateLegend(languages) {
  elements.languageLegend.innerHTML = languages
    .map(
      (item) => `
        <span class="legend-item">
          <span class="legend-swatch" style="background:${item.color}"></span>
          ${item.language}
          <strong>${item.count}</strong>
        </span>
      `,
    )
    .join('');
}

export function showLoading(progress) {
  const hasProgress = progress.total > 0;
  elements.loadingProgress.textContent = hasProgress
    ? `Mapping commit counts ${progress.done}/${progress.total}`
    : 'Building constellation';
  elements.loadingOverlay.classList.remove('hidden');
}

export function hideLoading() {
  elements.loadingOverlay.classList.add('hidden');
}

export function showNotice(status, message) {
  elements.dataNotice.classList.add('hidden');
  elements.dataSource.classList.add('hidden');

  if (status === 'fallback' || status === 'partial') {
    elements.dataNotice.textContent = message;
    elements.dataNotice.classList.remove('hidden');
    return;
  }

  if (status === 'ready' || status === 'cached') {
    elements.dataSource.textContent = message;
    elements.dataSource.classList.remove('hidden');
  }
}

export function showInfoPanel(body) {
  const { repo, kind, language } = body;
  const stats = [
    {
      label: 'Commits',
      value: repo.commitCountUnavailable ? 'Unavailable' : repo.commitCount,
      icon: '<path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-3 3" />',
    },
    {
      label: 'Stars',
      value: repo.stars,
      icon: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />',
    },
    {
      label: 'Forks',
      value: repo.forks,
      icon: '<path d="M6 3v12" /><path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" /><path d="M15 6h-3a6 6 0 0 0-6 6" />',
    },
    {
      label: 'Updated',
      value: formatDate(repo.updatedAt),
      icon: '<path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" />',
    },
  ];

  elements.panelKicker.textContent = kind === 'star' ? 'Central star' : 'Orbiting planet';
  elements.panelTitle.textContent = repo.name;
  elements.panelDescription.textContent = repo.description || 'No description provided.';
  elements.panelLanguage.innerHTML = `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m16 18 6-6-6-6" />
      <path d="m8 6-6 6 6 6" />
    </svg>
    <span>${language}</span>
  `;
  elements.panelStats.innerHTML = stats
    .map((stat) => statTemplate(stat.label, stat.value, stat.icon))
    .join('');
  elements.panelLink.href = repo.githubUrl;
  elements.panel.classList.remove('hidden');
}
