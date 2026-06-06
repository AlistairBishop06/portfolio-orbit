# Orbit

Orbit is a deployable React + Vite portfolio site that visualises the public repositories for [`AlistairBishop06`](https://github.com/AlistairBishop06) as a navigable 3D galaxy.

Repositories are fetched from the GitHub REST API, grouped by primary language, and transformed into solar systems. The highest-commit repository in each language becomes the central star; the rest become orbiting planets whose size, brightness, and orbital distance are based on commit count.

## Features

- Public GitHub repository fetching with commit count enrichment
- Live GitHub data cached in the browser to avoid burning through the public API limit
- Graceful sample-data fallback only when GitHub and cached live data are unavailable
- Language-grouped 3D solar systems using React Three Fiber and Three.js
- Hover labels, click-to-open repository details, and smooth camera controls
- Cinematic space scene with particles, stars, glow, orbit rings, and responsive UI

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

The app uses the unauthenticated public GitHub REST API in the browser. If GitHub's hourly
rate limit is exhausted before any live data has been cached, Orbit temporarily shows
sample data and tries GitHub again on the next load after the limit resets.

## Build

```bash
npm run build
npm run preview
```

The production output is written to `dist/`.

## Deploy

### Vercel

1. Import this repository in Vercel.
2. Use `npm run build` as the build command.
3. Use `dist` as the output directory.

### GitHub Pages

The Vite config uses `base: './'`, so the built assets work from a repository subpath.

```bash
npm run build
```

Then deploy the `dist/` folder with your preferred GitHub Pages workflow or tool, such as `gh-pages`.
