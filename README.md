# Orbit

Orbit is a static GitHub Pages portfolio site that visualises the public repositories for [`AlistairBishop06`](https://github.com/AlistairBishop06) as a navigable 3D galaxy.

Repositories are fetched from the GitHub REST API, grouped by primary language, and transformed into solar systems. The highest-commit repository in each language becomes the central star; the rest become orbiting planets whose size, brightness, and orbital distance are based on commit count.

## Files

```text
scripts/
  00-config.js
  01-sampleRepos.js
  02-github.js
  03-galaxyLayout.js
  04-ui.js
  05-scene.js
index.html
main.js
style.css
README.md
```

## Features

- Plain HTML, CSS, and JavaScript modules
- Public GitHub repository fetching with commit count enrichment
- Live GitHub data cached in the browser to reduce public API rate-limit issues
- Graceful sample-data fallback only when GitHub and cached live data are unavailable
- Language-grouped 3D solar systems using Three.js from a CDN
- Hover labels, click-to-open repository details, and smooth camera controls
- Cinematic space scene with particles, stars, glow, orbit rings, and responsive UI

## Run Locally

Because the site uses JavaScript modules, run it through a small local server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub API Note

Orbit uses the unauthenticated public GitHub REST API in the browser. If GitHub's hourly rate limit is exhausted before any live data has been cached, Orbit temporarily shows sample data and tries GitHub again on the next load after the limit resets.

## Deploy To GitHub Pages

1. Commit `index.html`, `style.css`, `main.js`, `scripts/`, and this `README.md`.
2. Push to GitHub.
3. In the repository, open `Settings` -> `Pages`.
4. Set the source to your chosen branch and root folder.
5. Save. GitHub Pages will serve `index.html` directly.

No build step is required.
