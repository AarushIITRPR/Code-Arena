# CodeArena frontend

This directory contains the React frontend for CodeArena. It was created with Vite and uses the backend API through Vite's `/api` proxy.

## Commands

```bash
pnpm install       # install dependencies
pnpm run dev       # start the Vite development server
pnpm run build     # create a production build
pnpm run lint      # run Oxlint
pnpm run preview   # preview the production build
```

The development server runs at [http://localhost:5173](http://localhost:5173). The Express backend should be running on port `4000`.

## Source layout

```text
src/
|-- pages/
|   |-- InboxPage.jsx
|   |-- DiscoveryPage.jsx
|   |-- InsightsPage.jsx
|   |-- RevisionPage.jsx
|
|-- styles/
|   |-- base.css          # shell, navigation, typography, shared controls
|   |-- pages.css         # discovery and revision layouts
|   |-- insights.css      # charts, profile header, and activity calendar
|   |-- responsive.css    # tablet and mobile breakpoints
|
|-- App.jsx               # application state, API calls, and derived data
|-- components.jsx        # sidebar, headers, empty state, and activity calendar
|-- lib.js                # shared constants, formatters, and date helpers
|-- main.jsx              # React entry point
```

## Data flow

`App.jsx` owns the data used across screens:

- the active Codeforces profile snapshot;
- problem discovery filters and results;
- tracked practice problems;
- loading and error states.

It passes the required data and callback functions to each page. For example, `DiscoveryPage` displays search results and calls `onTrack`, while the actual POST request remains in `App.jsx`.

This is intentionally simpler than adding Context or a state library. The application is small enough for the data flow to remain readable through normal props.

## Styling approach

The interface uses Newsreader for editorial headings and Manrope for controls and body text. Most screens use whitespace, typography, and thin rules instead of placing every section inside a card.

The styles are split by responsibility, but they still use ordinary class names and CSS media queries. There is no UI framework or custom design-system layer to learn before editing a page.

## Main dependencies

- `react` and `react-dom` for the interface;
- `recharts` for the rating chart;
- `lucide-react` for interface icons;
- `@fontsource-variable` packages for local fonts.

For full setup instructions and backend details, see the [project README](../README.md).
