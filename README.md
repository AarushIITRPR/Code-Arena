# CodeArena

CodeArena is a placement-prep workspace built around Codeforces. It brings problem discovery, practice planning, revision notes, and profile analytics into one place.

I started this project because my Codeforces profile could tell me what I had submitted, but it did not help me decide what to practise next or remember why I got a problem wrong. I was using bookmarks and notes for that part of the workflow, so I wanted to build a small tool that connected both sides.

## What it does

CodeArena currently has four main screens:

- **Practice Inbox:** a short queue of problems I plan to solve, with a status and practice queue for each one.
- **Problem Discovery:** search the Codeforces problemset by title, problem ID, rating range, and multiple tags.
- **Profile Insights:** sync a Codeforces handle and view rating-wise solves, topic coverage, solve rate, and a submission activity calendar.
- **Revision Log:** keep mistake types, confidence scores, and notes for problems that need another attempt.

The discovery page also checks the synced submission history, so a problem can be marked as solved, unsuccessfully attempted, or unattempted before it is added to the tracker.

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | React, Vite, CSS, Recharts, Lucide React |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| External data | Codeforces public API |

I kept the frontend in plain React and CSS instead of using a component framework. This made the interface easier for me to understand and gave me more control over the visual design.

## How it works

```text
React frontend
      |
      | requests to /api/*
      v
Express server
      |
      +------ Codeforces API
      |
      +------ MongoDB
```

The browser never calls Codeforces directly. It calls the Express API, which fetches and normalizes Codeforces data before returning it to React.

MongoDB stores three kinds of data:

1. A cached copy of the Codeforces problemset.
2. Synced profile and submission snapshots for Codeforces handles.
3. Problems added to the practice and revision workflow.

Problem and profile data stay cached until the user chooses to refresh them. This avoids downloading the full problemset or recalculating submission analytics on every page load.

## Running the project locally

You need Node.js, pnpm, and either a local MongoDB installation or a MongoDB Atlas connection string.

### 1. Clone the repository

```bash
git clone https://github.com/AarushIITRPR/Code-Arena.git
cd Code-Arena
```

### 2. Configure the backend

```bash
cd server
pnpm install
```

Copy `server/.env.example` to `server/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/codearena
PORT=4000
```

`MONGODB_URI` is optional for a quick demo. If it is missing and local MongoDB is unavailable, the server starts an in-memory MongoDB instance. Data in that fallback database is lost when the server stops.

Start the API:

```bash
pnpm run dev
```

### 3. Start the frontend

Open another terminal:

```bash
cd client
pnpm install
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the backend on port `4000`.

## Main API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check whether the server is running |
| `GET` | `/api/codeforces/problems` | Search the cached Codeforces problemset |
| `POST` | `/api/codeforces/problems/refresh` | Download a fresh problemset |
| `GET` | `/api/codeforces/dashboard/:handle` | Read a cached profile snapshot |
| `POST` | `/api/codeforces/dashboard/:handle/refresh` | Sync profile and submission history |
| `GET` | `/api/problems` | List tracked problems |
| `POST` | `/api/problems` | Add a problem to the tracker |
| `PATCH` | `/api/problems/:id` | Update status, queue, notes, or confidence |
| `DELETE` | `/api/problems/:id` | Remove a tracked problem |

Problem discovery accepts `search`, `tags`, `minRating`, `maxRating`, `page`, and `limit` as query parameters.

## Project structure

```text
Code-Arena/
|-- client/
|   |-- src/
|       |-- pages/          # Four main screens
|       |-- styles/         # Shared, page, insights, and responsive CSS
|       |-- App.jsx         # State, API calls, and page selection
|       |-- components.jsx  # Shared visual components
|       |-- lib.js          # Constants and formatting helpers
|
|-- server/
    |-- src/
        |-- db/             # MongoDB connection
        |-- models/         # Mongoose schemas
        |-- routes/         # Tracked problem CRUD routes
        |-- services/       # Codeforces integration and caching
        |-- index.js        # Express app and API routes
```

I deliberately kept the frontend structure small. `App.jsx` owns data and actions, while each page component mainly receives props and renders one screen. There is no global state library or large reusable component system.

## Current limitations

- Codeforces is the only supported coding platform.
- The practice tracker is currently single-user and has no authentication.
- Analytics use the latest 1,000 submissions requested during a sync.
- CodeArena links to the original problem page; it is not an online judge or in-browser IDE.
- The app depends on the availability and response format of the Codeforces API.

These are intentional V1 limits. The goal was to finish a complete and understandable MERN project before adding more platforms or larger features.

## What I learned

This project helped me understand how a React frontend, an Express API, an external API, and MongoDB fit together in one application. The most useful parts for me were designing the data flow, normalizing third-party data, deciding what should be cached, and turning raw submission history into information that is actually useful while practising.

## References

- [Codeforces API](https://codeforces.com/apiHelp)
- [React](https://react.dev/)
- [Express](https://expressjs.com/)
- [Mongoose](https://mongoosejs.com/)
