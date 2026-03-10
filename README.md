# Project Map Dashboard

A React + Google Maps web application that visualizes project locations from Google Sheets and enriches them with Trello project data.

The application displays projects on a map with custom markers, showing progress percentage, address information, and associated Trello card status.

---

# Features

## Map Visualization

- Displays project locations on a Google Map
- Uses **Google Maps AdvancedMarkerElement** for custom markers
- Custom SVG marker pins with glow and hover animation
- Map automatically fits bounds to all markers

## Project Data Integration

- Reads project progress data from **Google Sheets**
- Reads project address data from **Google Sheets**
- Fuzzy matches project names across sheets
- Geocodes addresses to coordinates using Google Geocoding API

## Trello Integration

- Fetches cards from a Trello board
- Matches Trello cards to projects
- Displays Trello data in marker popup:
  - Card name
  - List status
  - Labels
  - Due date
  - Link to Trello card

## Popup UI

Each marker opens a React-rendered InfoWindow containing:

- Project name
- Completion percentage
- Address
- Trello status
- Trello labels
- Link to Trello card

---

# Tech Stack

## Frontend

- React
- Vite
- Google Maps JavaScript API
- AdvancedMarkerElement

## Backend

- Node.js
- Express

## External APIs

- Google Sheets API
- Google Geocoding API
- Google Maps JavaScript API
- Trello API

---

# Project Architecture

```
Google Sheets A (progress data)
Google Sheets B (address data)

        │
        ▼

Node / Express Backend
/api/locations

        │
        ▼

React Frontend
Google Maps Markers
InfoWindow Popup
```

---

# Data Sources

## Spreadsheet A — Progress Data

Range:

```
Sheet1!B:E
```

Columns:

| Column | Description |
|------|------|
| B | Project Name |
| E | Completion Percentage |

Allowed values:

```
10%
50%
75%
```

Projects marked **100% are filtered out**.

---

## Spreadsheet B — Address Data

Range:

```
Sheet1!A:D
```

Columns:

| Column | Description |
|------|------|
| A | Project Name |
| D | Address |

---

# Project Matching

Project names between sheets are matched using a normalization and fuzzy matching pipeline.

## Normalization

Removes:

- punctuation
- parentheses text
- the word "the"
- converts `saint → st`
- converts `& → and`

Example:

```
Smith Residence (Phase 1)
Smith Residence
```

Normalize to:

```
smith residence
```

## Matching Strategy

1. Exact normalized match  
2. Partial contains match  
3. Token overlap fuzzy match  

Minimum fuzzy score:

```
0.6
```

---

# Geocoding

Addresses are converted to coordinates using:

```
Google Geocoding API
```

Results are cached in memory to reduce duplicate API calls.

---

# Trello Integration

Trello cards are fetched using the Trello REST API:

```
GET /1/boards/{boardId}/cards
GET /1/boards/{boardId}/lists
```

Cards are normalized into this structure:

```js
{
  cardId,
  cardName,
  list,
  labels,
  due,
  url,
  shortLink,
  closed
}
```

Cards are matched to project markers using the same fuzzy name matching logic.

---

# API Endpoint

## GET `/api/locations`

Returns:

```json
{
  "markers": [],
  "unmatchedNames": [],
  "unmatchedTrelloCards": [],
  "counts": {
    "sheetARows": 0,
    "sheetBCandidates": 0,
    "matched": 0,
    "geocoded": 0,
    "unmatched": 0,
    "trelloCards": 0,
    "trelloMatched": 0,
    "trelloUnmatched": 0
  }
}
```

---

# Marker Structure

Each marker returned from the API contains:

```js
{
  name: "Project Name",
  matchedName: "Matched Sheet Name",
  percentage: "75%",
  address: "...",
  lat: 39.7392,
  lng: -104.9903,

  trello: {
    cardId,
    cardName,
    list,
    labels,
    due,
    url
  }
}
```

---

# Frontend Structure

```
src
 ├── App.jsx
 ├── Map.jsx
 ├── InfoWindowContent.jsx
 ├── googleMapsLoader.js
 └── main.jsx
```

## Map.jsx

Handles:

- fetching `/api/locations`
- initializing Google Maps
- rendering markers
- managing InfoWindow
- fitting map bounds

## InfoWindowContent.jsx

React component that renders the popup UI for markers.

Displays:

- project details
- Trello card information
- Trello labels
- Trello status badge
- link to Trello card

---

# Environment Variables

Create a `.env` file in the project root.

Example:

```
PORT=3000

SHEET_A_SPREADSHEET_ID=...
SHEET_B_SPREADSHEET_ID=...

GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY=...

GEOCODE_API_KEY=...

TRELLO_KEY=...
TRELLO_TOKEN=...
TRELLO_BOARD_ID=...
```

---

# Running the Project

Install dependencies:

```
npm install
```

Run backend server:

```
node server.js
```

Run frontend development server:

```
npm run dev
```

Open the app:

```
http://localhost:5173
```

---

# Current Capabilities

The system currently supports:

- Google Sheets project ingestion
- fuzzy project name matching
- address geocoding
- Trello board integration
- custom map markers
- React-based InfoWindow UI

Projects appear on the map with progress indicators and Trello status.

---

# Future Improvements

## Map Features

- marker clustering
- filtering by completion %
- filtering by Trello status
- project search

## UI Improvements

- Trello label chips
- improved popup layout
- status icons

## Backend Improvements

- persistent geocode cache
- Trello response caching
- debugging endpoints

## Trello Data Expansion

- custom fields
- checklist progress
- assigned members

---

# License

Private internal project.