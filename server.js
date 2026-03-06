import express from "express";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();
// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 3000;

const {
  SHEET_A_SPREADSHEET_ID,
  SHEET_B_SPREADSHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GEOCODE_API_KEY,
  SHEET_A_RANGE = "Sheet1!B:E",
  SHEET_B_RANGE = "Sheet1!A:D"
// eslint-disable-next-line no-undef
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
  key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
});

const sheets = google.sheets({
  version: "v4",
  auth
});

const geocodeCache = new Map();
const ALLOWED_PERCENTAGES = new Set(["10%", "50%", "75%"]);

function normalizePercentage(value) {
  return String(value ?? "").trim();
}

function meetsCriteria(value) {
  return ALLOWED_PERCENTAGES.has(normalizePercentage(value));
}

function normalizeName(name) {
  return String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/\(.*?\)/g, "")
    .replace(/&/g, "and")
    .replace(/[^\w\s]/g, " ")
    .replace(/\bsaint\b/g, "st")
    .replace(/\bthe\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeName(name) {
  return normalizeName(name).split(" ").filter(Boolean);
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
  const normalizedInput = normalizeName(inputName);

  if (!normalizedInput) {
    return {
      match: null,
      reason: "Name empty after normalization"
    };
  }

  for (const candidate of candidates) {
    if (normalizeName(candidate.name) === normalizedInput) {
      return {
        match: candidate,
        reason: "Exact normalized match"
      };
    }
  }

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate.name);

    if (
      normalizedCandidate.includes(normalizedInput) ||
      normalizedInput.includes(normalizedCandidate)
    ) {
      return {
        match: candidate,
        reason: "Partial contains match"
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
      reason: "No token overlap with any candidate"
    };
  }

  if (bestScore < 0.6) {
    return {
      match: null,
      reason: `Best candidate "${bestCandidate.name}" score too low (${bestScore.toFixed(2)})`
    };
  }

  return {
    match: bestCandidate,
    reason: `Fuzzy token match score ${bestScore.toFixed(2)}`
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
      }`
    );
    geocodeCache.set(normalized, null);
    return null;
  }

  const location = data.results[0].geometry.location;

  const result = {
    lat: location.lat,
    lng: location.lng,
    formattedAddress: data.results[0].formatted_address
  };

  geocodeCache.set(normalized, result);
  return result;
}

app.get("/api/locations", async (req, res) => {
  try {
    const [sheetAResponse, sheetBResponse] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_A_SPREADSHEET_ID,
        range: SHEET_A_RANGE
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_B_SPREADSHEET_ID,
        range: SHEET_B_RANGE
      })
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
        address
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
          `[FILTERED] "${originalName}" skipped because percentage = "${percentage}"`
        );
        continue;
      }

      const result = findBestLooseMatch(originalName, sheetBCandidates);

      if (!result.match) {
        console.warn(
          `[UNMATCHED] "${originalName}" - reason: ${result.reason}`
        );

        unmatchedNames.push({
          name: originalName,
          percentage,
          reason: result.reason
        });

        continue;
      }

      console.log(
        `[MATCHED] "${originalName}" -> "${result.match.name}" (${result.reason})`
      );

      joinedRows.push({
        name: originalName,
        matchedName: result.match.name,
        percentage,
        address: result.match.address
      });
    }

    const markers = [];

    for (const row of joinedRows) {
      const geo = await geocodeAddress(row.address);

      if (!geo) {
        console.warn(
          `[SKIPPED AFTER MATCH] "${row.name}" matched "${row.matchedName}" but geocoding failed`
        );
        continue;
      }

      markers.push({
        name: row.name,
        matchedName: row.matchedName,
        percentage: row.percentage,
        address: geo.formattedAddress,
        lat: geo.lat,
        lng: geo.lng
      });
    }

    res.json({
      markers,
      unmatchedNames,
      counts: {
        sheetARows: sheetARows.length,
        sheetBCandidates: sheetBCandidates.length,
        matched: joinedRows.length,
        geocoded: markers.length,
        unmatched: unmatchedNames.length
      }
    });
  } catch (error) {
    console.error("API error:", error);

    res.status(500).json({
      error: "Failed to load locations",
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});