import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { google } from "googleapis";
import { fetchBoardCardsWithLists } from "./trello.js";
import { findBestMatch, normalizeProjectName, scoreNameMatch } from "./matching.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:5173",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      const normalizedAllowedOrigins = allowedOrigins.map((o) => o.replace(/\/$/, ""));

      if (normalizedAllowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      console.error("Blocked by CORS:", origin);
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});



app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

const {
  SHEET_A_SPREADSHEET_ID,
  SHEET_B_SPREADSHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GEOCODE_API_KEY,
  SHEET_A_RANGE = "Sheet1!B:E",
  SHEET_B_RANGE = "Sheet1!A:D",
  TRELLO_BOARD_ID,
} = process.env;

if (
  !SHEET_A_SPREADSHEET_ID ||
  !SHEET_B_SPREADSHEET_ID ||
  !GOOGLE_SERVICE_ACCOUNT_EMAIL ||
  !GOOGLE_PRIVATE_KEY ||
  !GEOCODE_API_KEY
) {
  console.warn("Missing one or more required environment variables.");
}

const auth = new google.auth.JWT({
  email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

const geocodeCache = new Map();
const ALLOWED_PERCENTAGES = new Set(["10%", "50%", "75%"]);

function normalizePercentage(value) {
  return String(value ?? "").trim();
}

function meetsCriteria(value) {
  return ALLOWED_PERCENTAGES.has(normalizePercentage(value));
}

function tokenizeName(name) {
  return normalizeProjectName(name).split(" ").filter(Boolean);
}

function tokenOverlapScore(nameA, nameB) {
  const tokensA = new Set(tokenizeName(nameA));
  const tokensB = new Set(tokenizeName(nameB));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      overlap++;
    }
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

function findBestLooseMatch(inputName, candidates) {
  const normalizedInput = normalizeProjectName(inputName);

  if (!normalizedInput) {
    return {
      match: null,
      reason: "Name empty after normalization",
    };
  }

  for (const candidate of candidates) {
    if (normalizeProjectName(candidate.name) === normalizedInput) {
      return {
        match: candidate,
        reason: "Exact normalized match",
      };
    }
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeProjectName(candidate.name);

    if (
      normalizedCandidate.includes(normalizedInput) ||
      normalizedInput.includes(normalizedCandidate)
    ) {
      return {
        match: candidate,
        reason: "Partial contains match",
      };
    }
  }

  let bestCandidate = null;
  let bestScore = 0;

  for (const candidate of candidates) {
    const score = tokenOverlapScore(inputName, candidate.name);

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  if (!bestCandidate) {
    return {
      match: null,
      reason: "No token overlap with any candidate",
    };
  }

  if (bestScore < 0.6) {
    return {
      match: null,
      reason: `Best candidate "${bestCandidate.name}" score too low (${bestScore.toFixed(2)})`,
    };
  }

  return {
    match: bestCandidate,
    reason: `Fuzzy token match score ${bestScore.toFixed(2)}`,
  };
}

async function geocodeAddress(address) {
  if (!address) return null;

  const normalized = String(address).trim();

  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized);
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", normalized);
  url.searchParams.set("key", GEOCODE_API_KEY);

  const res = await fetch(url.toString());

  if (!res.ok) {
    throw new Error(`Geocoding request failed with status ${res.status}`);
  }

  const data = await res.json();

  if (data.status !== "OK" || !data.results?.length) {
    console.warn(
      `[GEOCODE FAILED] "${normalized}" - status: ${data.status} - message: ${
        data.error_message || "No error message returned"
      }`,
    );
    geocodeCache.set(normalized, null);
    return null;
  }

  const location = data.results[0].geometry.location;

  const result = {
    lat: location.lat,
    lng: location.lng,
    formattedAddress: data.results[0].formatted_address,
  };

  geocodeCache.set(normalized, result);
  return result;
}

app.get("/api/locations", async (req, res) => {
  try {
    const [sheetAResponse, sheetBResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_A_SPREADSHEET_ID,
        range: SHEET_A_RANGE,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_B_SPREADSHEET_ID,
        range: SHEET_B_RANGE,
      }),
    ]);

    const sheetARows = sheetAResponse.data.values || [];
    const sheetBRows = sheetBResponse.data.values || [];

    const sheetBCandidates = [];

    for (const row of sheetBRows) {
      const name = String(row[0] ?? "").trim();
      const address = String(row[3] ?? "").trim();

      if (!name || !address) continue;

      sheetBCandidates.push({
        name,
        address,
      });
    }

    const joinedRows = [];
    const unmatchedNames = [];

    for (const row of sheetARows) {
      const originalName = String(row[0] ?? "").trim();
      const percentage = normalizePercentage(row[3]);

      if (!originalName) continue;

      if (!meetsCriteria(percentage)) {
        console.warn(
          `[FILTERED] "${originalName}" skipped because percentage = "${percentage}"`,
        );
        continue;
      }

      const result = findBestLooseMatch(originalName, sheetBCandidates);

      if (!result.match) {
        console.warn(
          `[UNMATCHED] "${originalName}" - reason: ${result.reason}`,
        );

        unmatchedNames.push({
          name: originalName,
          percentage,
          reason: result.reason,
        });

        continue;
      }

      console.log(
        `[MATCHED] "${originalName}" -> "${result.match.name}" (${result.reason})`,
      );

      joinedRows.push({
        name: originalName,
        matchedName: result.match.name,
        percentage,
        address: result.match.address,
      });
    }

    const markers = [];

    for (const row of joinedRows) {
      const geo = await geocodeAddress(row.address);

      if (!geo) {
        console.warn(
          `[SKIPPED AFTER MATCH] "${row.name}" matched "${row.matchedName}" but geocoding failed`,
        );
        continue;
      }

      markers.push({
        name: row.name,
        matchedName: row.matchedName,
        percentage: row.percentage,
        address: geo.formattedAddress,
        lat: geo.lat,
        lng: geo.lng,
      });
    }

    let trelloCards = [];
    if (TRELLO_BOARD_ID) {
      trelloCards = await fetchBoardCardsWithLists(TRELLO_BOARD_ID);
      console.log(`[TRELLO] Fetched ${trelloCards.length} cards`);
    } else {
      console.warn("[TRELLO] No TRELLO_BOARD_ID set, skipping Trello merge");
    }

    const usedCardIds = new Set();

    const enrichedMarkers = markers.map((marker) => {
      const availableCards = trelloCards
        .filter((card) => !usedCardIds.has(card.cardId))
        .map((card) => ({
          ...card,
          name: card.cardName,
        }));

      const { match, score } = findBestMatch(
        marker.matchedName || marker.name,
        availableCards,
        0.6,
      );

      if (!match) {
        return {
          ...marker,
          trello: null,
        };
      }

      usedCardIds.add(match.cardId);

      return {
        ...marker,
        trello: {
          cardId: match.cardId,
          cardName: match.cardName,
          list: match.list,
          labels: match.labels,
          due: match.due,
          url: match.url,
          shortLink: match.shortLink,
          closed: match.closed,
          matchScore: Number(score.toFixed(2)),
        },
      };
    });

    console.log(
      "trello matched:",
      enrichedMarkers.filter((m) => m.trello).length,
    );
    
    const unmatchedTrelloCards = trelloCards
      .filter((card) => !usedCardIds.has(card.cardId))
      .map((card) => ({
        cardId: card.cardId,
        cardName: card.cardName,
        list: card.list,
        due: card.due,
        url: card.url,
      }));

    res.json({
      markers: enrichedMarkers,
      unmatchedNames,
      unmatchedTrelloCards,
      counts: {
        sheetARows: sheetARows.length,
        sheetBCandidates: sheetBCandidates.length,
        matched: joinedRows.length,
        geocoded: markers.length,
        unmatched: unmatchedNames.length,
        trelloCards: trelloCards.length,
        trelloMatched: enrichedMarkers.filter((marker) => marker.trello).length,
        trelloUnmatched: unmatchedTrelloCards.length,
      },
    });
  } catch (error) {
    console.error("API error:", error);

    res.status(500).json({
      error: "Failed to load locations",
      details: error.message,
    });
  }
});
