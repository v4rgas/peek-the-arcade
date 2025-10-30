# 🕹️ Peek the Arcade

A simple frontend to list and test games from platanus-hack-25-arcade forks.

## Features

- Lists all users who forked [platanus-hack/platanus-hack-25-arcade](https://github.com/platanus-hack/platanus-hack-25-arcade)
- Filter to show/hide forks with unchanged games
- Click "Play Game" to load and run their game.js
- Simple, clean interface

## How to use

```bash
pnpm install
pnpm run dev
```

Then open the URL shown (usually http://localhost:5173)

## Technical details

- Pure vanilla JS with Vite for dev server
- Uses GitHub GraphQL API to efficiently fetch forks with commit counts
- Loads game.js files via iframe for isolation
- KISS principle applied throughout
