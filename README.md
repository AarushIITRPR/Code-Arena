# CodeArena

CodeArena is a Codeforces-powered placement-prep workspace that combines coding profile insights, problem discovery, practice planning, attempt tracking, revision notes, and analytics.

## Problem

Students preparing for coding rounds often use Codeforces for practice, but planning and reflection are scattered across browser bookmarks, sheets, notes, and platform dashboards. CodeArena focuses on the workflow after opening a coding platform: what to solve next, what was attempted, what needs revision, and which topics or rating bands need more work.

## Target User

Students preparing for online assessments, competitive programming practice, and placement coding rounds.

## V1 Scope

- Codeforces profile dashboard with handle, solved count, recent activity, and rating/topic breakdowns.
- Problem discovery using Codeforces problem metadata, ratings, tags, and title search.
- Practice planner for adding problems to planned and revision queues.
- Attempt tracking with statuses: Planned, Attempted, Solved, Revise.
- Reflection fields such as notes, mistake type, and confidence score.
- Analytics for rating-band progress, weak topics, attempted vs solved counts, and revision list.

## Implemented Features

- React dashboard for syncing a Codeforces handle and viewing solved count, attempted count, current rating, topic distribution, and rating-band distribution.
- Codeforces problem discovery with title/id search, tag filter, rating range filter, cache refresh, and recommended picks from the active search.
- MongoDB-backed practice tracker for saving problems, changing status/queue, recording mistake notes, assigning confidence scores, and deleting tracked items.
- Express REST API layer that keeps external Codeforces calls separate from frontend-facing routes.
- Mongoose schemas for cached Codeforces problem metadata, user dashboard snapshots, and tracked practice problems.

## Tech Stack

- Frontend: React, Vite, CSS, lucide-react
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- External API: Codeforces public API

## Quick Start

Install dependencies once in both apps:

```text
cd server
pnpm install

cd ../client
pnpm install
```

Start the backend:

```text
cd server
pnpm run dev
```

Start the frontend:

```text
cd client
pnpm run dev
```

Open:

```text
http://localhost:5173
```

## Out Of Scope For V1

- Online judge or code execution.
- In-browser IDE.
- LeetCode, GFG, or CodeChef unofficial API integrations.
- AI recommendations.
- Social/community features.
- Authentication beyond a simple local/demo profile, unless added later.

## Architecture

```text
React frontend
  |
  | REST API requests
  v
Express backend running on Node.js
  |                         |
  |                         v
  |                  Codeforces API
  v
MongoDB database
```

The React frontend handles the interface, filters, forms, and dashboard views. The Express backend exposes REST API routes, normalizes Codeforces API responses, stores user-specific practice data, and returns clean JSON to the frontend. MongoDB stores tracked problems, statuses, notes, mistake types, confidence scores, and queue metadata through Mongoose models.

## Backend Environment

The backend reads MongoDB configuration from:

```text
MONGODB_URI
```

For local development, copy `server/.env.example` to `server/.env` and use either a local MongoDB URI or a MongoDB Atlas connection string.

If `MONGODB_URI` is not provided and local MongoDB is unavailable, the backend starts an in-memory development database so the app can still be demoed locally. Use a real MongoDB URI when you want data to persist across restarts.

## Codeforces API Data Map

Codeforces API requests use this base pattern:

```text
https://codeforces.com/api/{methodName}
```

Codeforces returns JSON with `status`, optional `comment`, and `result`. Public methods can be requested anonymously, and the documented request limit is one API call per two seconds.

### 1. User Profile

Endpoint:

```text
GET https://codeforces.com/api/user.info?handles={handle}
```

Used for:

- Profile header
- Current rating and rank
- Max rating and max rank
- Contribution
- Avatar/title photo
- Last online time
- Registration time
- Friend count

Important raw fields:

```text
handle
rank
rating
maxRank
maxRating
contribution
avatar
titlePhoto
lastOnlineTimeSeconds
registrationTimeSeconds
friendOfCount
```

Clean object we may return from our backend:

```json
{
  "handle": "tourist",
  "rank": "legendary grandmaster",
  "rating": 3911,
  "maxRank": "legendary grandmaster",
  "maxRating": 3979,
  "contribution": 0,
  "avatar": "https://...",
  "titlePhoto": "https://...",
  "lastOnlineAt": "2026-06-25T12:00:00.000Z",
  "registeredAt": "2010-01-01T12:00:00.000Z",
  "friendOfCount": 100000
}
```

### 2. User Submissions

Endpoint:

```text
GET https://codeforces.com/api/user.status?handle={handle}&from=1&count={count}
```

Used for:

- Solved count
- Attempted vs solved analytics
- Recent activity
- Recent submissions table
- Accepted problem set
- Topic-wise solved breakdown
- Rating-band solved breakdown
- Weak topic inference from repeated non-OK verdicts

Important raw fields from each submission:

```text
id
contestId
creationTimeSeconds
problem
programmingLanguage
verdict
passedTestCount
timeConsumedMillis
memoryConsumedBytes
```

Important nested `problem` fields:

```text
contestId
index
name
rating
tags
```

Clean object we may return from our backend:

```json
{
  "id": 123456789,
  "submittedAt": "2026-06-25T12:00:00.000Z",
  "verdict": "OK",
  "programmingLanguage": "GNU C++17",
  "passedTestCount": 20,
  "timeConsumedMillis": 46,
  "memoryConsumedBytes": 0,
  "problem": {
    "platform": "Codeforces",
    "externalId": "4-A",
    "title": "Watermelon",
    "url": "https://codeforces.com/problemset/problem/4/A",
    "rating": 800,
    "tags": ["brute force", "math"],
    "contestId": 4,
    "problemIndex": "A"
  }
}
```

### 3. Problem Discovery

Endpoint:

```text
GET https://codeforces.com/api/problemset.problems
```

Optional Codeforces-side tag filter:

```text
GET https://codeforces.com/api/problemset.problems?tags=implementation
```

Used for:

- Problem search
- Rating filters
- Tag filters
- Problem discovery cards/table
- Add-to-practice-queue source data

Codeforces returns:

```text
problems
problemStatistics
```

For v1, CodeArena only uses `problems`. `problemStatistics` mainly provides `solvedCount`, which is not needed for the first version.

Important raw fields from `problems`:

```text
contestId
problemsetName
index
name
type
points
rating
tags
```

Clean `CodeforcesProblem` object:

```json
{
  "platform": "Codeforces",
  "externalId": "4-A",
  "title": "Watermelon",
  "url": "https://codeforces.com/problemset/problem/4/A",
  "rating": 800,
  "tags": ["brute force", "math"],
  "contestId": 4,
  "contestDivision": null,
  "problemIndex": "A"
}
```

Notes:

- `status`, `notes`, `mistakeType`, and `confidence` are not Codeforces fields. They are CodeArena tracking fields added after the user plans or tracks a problem.
- `contestDivision` is not directly available on the Codeforces `Problem` object. In v1 it can stay `null`; later we can infer it from contest metadata if useful.

### 4. Rating History

Endpoint:

```text
GET https://codeforces.com/api/user.rating?handle={handle}
```

Used for:

- Optional rating history chart
- Rating progression summary
- Contest performance timeline

Important raw fields:

```text
contestId
contestName
handle
rank
ratingUpdateTimeSeconds
oldRating
newRating
```

Clean object we may return from our backend:

```json
{
  "contestId": 566,
  "contestName": "Codeforces Round",
  "rank": 120,
  "ratedAt": "2026-06-25T12:00:00.000Z",
  "oldRating": 1200,
  "newRating": 1264,
  "delta": 64
}
```

### 5. Contest Metadata

Endpoint:

```text
GET https://codeforces.com/api/contest.list?gym=false
```

Used for:

- Optional contest metadata lookup
- Contest name display
- Possible future `contestDivision` inference from contest names

Important raw fields:

```text
id
name
type
phase
durationSeconds
startTimeSeconds
difficulty
kind
```

This is optional for v1. The main v1 features can work without contest metadata.

## CodeArena Internal Data Models

### CodeforcesProblem

Problems returned by our discovery API before the user tracks them.

```json
{
  "platform": "Codeforces",
  "externalId": "4-A",
  "title": "Watermelon",
  "url": "https://codeforces.com/problemset/problem/4/A",
  "rating": 800,
  "tags": ["brute force", "math"],
  "contestId": 4,
  "contestDivision": null,
  "problemIndex": "A"
}
```

### TrackedProblem

Problems added to the user's practice workflow.

```json
{
  "id": 1,
  "platform": "Codeforces",
  "externalId": "4-A",
  "title": "Watermelon",
  "url": "https://codeforces.com/problemset/problem/4/A",
  "rating": 800,
  "tags": ["brute force", "math"],
  "contestId": 4,
  "contestDivision": null,
  "problemIndex": "A",
  "status": "Planned",
  "queue": "Today",
  "notes": "",
  "mistakeType": null,
  "confidence": null,
  "createdAt": "2026-06-25T12:00:00.000Z",
  "updatedAt": "2026-06-25T12:00:00.000Z"
}
```

Allowed status values:

```text
Planned
Attempted
Solved
Revise
```

Potential queue values:

```text
Today
Revision
Weak Topic
Later
```

## Backend Routes

```text
GET    /api/health

GET    /api/codeforces/dashboard/:handle
POST   /api/codeforces/dashboard/:handle/refresh
GET    /api/codeforces/profile/:handle
GET    /api/codeforces/problems
POST   /api/codeforces/problems/refresh
GET    /api/codeforces/submissions/:handle?count=500
GET    /api/codeforces/rating/:handle

GET    /api/problems
POST   /api/problems
PATCH  /api/problems/:id
DELETE /api/problems/:id
```

Current Codeforces route behavior:

- `/api/codeforces/problems` returns normalized `CodeforcesProblem` objects and supports `search`, `tag`, `minRating`, `maxRating`, and `limit`.
- `/api/codeforces/problems/refresh` refreshes the MongoDB-backed Codeforces problem cache.
- `/api/codeforces/dashboard/:handle` returns a cached user snapshot when available.
- `/api/codeforces/dashboard/:handle/refresh` fetches fresh Codeforces profile, submissions, and rating data, then stores a new snapshot.
- `/api/codeforces/profile/:handle` returns normalized profile metadata from `user.info`.
- `/api/codeforces/submissions/:handle` returns recent normalized submissions plus summary counts and solved breakdowns from `user.status`.
- `/api/codeforces/rating/:handle` returns normalized rating history from `user.rating`.

Current tracked problem route behavior:

- `GET /api/problems` returns tracked practice problems and supports `status`, `queue`, `tag`, and `search`.
- `POST /api/problems` adds a Codeforces problem to the practice planner.
- `PATCH /api/problems/:id` updates tracking fields such as `status`, `queue`, `notes`, `mistakeType`, and `confidence`.
- `DELETE /api/problems/:id` removes a problem from the practice planner.

## Codeforces Sources

- Codeforces API introduction: https://codeforces.com/apiHelp
- Codeforces API methods: https://codeforces.com/apiHelp/methods
- Codeforces API return objects: https://codeforces.com/apiHelp/objects
