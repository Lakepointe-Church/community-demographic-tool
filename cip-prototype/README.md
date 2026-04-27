# Community Intelligence Platform — Prototype

Interactive dashboard prototype for Lakepointe Church's Community Intelligence Platform.

## Deploy to Vercel

### Option 1: One-click (recommended)
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo → Vercel auto-detects the static site → Deploy

### Option 2: Vercel CLI
```bash
cd cip-prototype
npx vercel --prod
```

### Option 3: Drag & Drop
1. Go to [vercel.com/new](https://vercel.com/new)
2. Drag the `cip-prototype` folder onto the page

## What's Included

- **7 interactive dashboard views**: Overview, Demographics, Family Segments, SES Classes, Religious Landscape, Employers, Site Scorer
- **20 real DFW ZIP codes** with realistic demographic data
- **Interactive charts** powered by Chart.js
- **CIP design system**: Dark mode, Bebas Neue + IBM Plex type system, semantic color palette
- **Site Scorer**: Adjustable weight sliders for multi-factor campus evaluation

## Tech

Single `index.html` file — no build step, no dependencies, no framework. Pure HTML/CSS/JS with Chart.js loaded from CDN.
