
import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/locations", async (req, res) => {
  // placeholder until we hook Google Sheets + geocoding
  res.json([
    { name: "Test", status: "In Progress", address: "Denver, CO", lat: 39.7392, lng: -104.9903 },
  ]);
});

app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));