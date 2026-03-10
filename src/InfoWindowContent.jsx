function getMarkerStyle(percentage) {
  const config = {
    "10%": { bg: "#ef4444", glow: "rgba(239, 68, 68, 0.20)" },
    "50%": { bg: "#f97316", glow: "rgba(249, 115, 22, 0.20)" },
    "75%": { bg: "#37ac62", glow: "rgba(34, 197, 94, 0.20)" },
  };

  return (
    config[percentage] || {
      bg: "#3b82f6",
      glow: "rgba(59, 130, 246, 0.20)",
    }
  );
}

function formatDueDate(due) {
  if (!due) return "None";

  const date = new Date(due);
  if (Number.isNaN(date.getTime())) return "None";

  return date.toLocaleDateString();
}

function getStatusBadgeStyle(listName) {
  const normalized = String(listName || "").toLowerCase();

  let background = "#f3f4f6";
  let color = "#374151";

  if (normalized.includes("sale")) {
    background = "#dbeafe";
    color = "#1d4ed8";
  } else if (normalized.includes("progress")) {
    background = "#ffedd5";
    color = "#c2410c";
  } else if (
    normalized.includes("done") ||
    normalized.includes("complete") ||
    normalized.includes("completed") ||
    normalized.includes("scheduled")
  ) {
    background = "#dcfce7";
    color = "#15803d";
  }

  return {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "999px",
    background,
    color,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.2,
  };
}

export default function InfoWindowContent({ markerData }) {
  const { bg } = getMarkerStyle(markerData.percentage);
  const trello = markerData.trello;

  return (
    <div
      style={{
        maxWidth: 280,
        padding: "4px 2px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.2,
          }}
        >
          {markerData.name}
        </div>

        <span
          style={{
            background: bg,
            color: "#fff",
            fontSize: 12,
            fontWeight: 800,
            padding: "5px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {markerData.percentage}
        </span>
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#374151",
          marginBottom: 6,
        }}
      >
        <strong>Matched:</strong> {markerData.matchedName || "—"}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#374151",
          lineHeight: 1.4,
          marginBottom: 10,
        }}
      >
        <strong>Address:</strong>
        <br />
        {markerData.address || "—"}
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          Trello
        </div>

        {trello ? (
          <>
            <div
              style={{
                fontSize: 13,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              <strong>Card:</strong> {trello.cardName || "—"}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              <strong>Status:</strong>{" "}
              <span style={getStatusBadgeStyle(trello.list)}>
                {trello.list || "Unknown"}
              </span>
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#374151",
                marginBottom: 6,
              }}
            >
              <strong>Due:</strong> {formatDueDate(trello.due)}
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              <strong>Labels:</strong>{" "}
              {trello.labels?.length ? trello.labels.join(", ") : "None"}
            </div>

            {trello.url ? (
              <a
                href={trello.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#2563eb",
                  textDecoration: "none",
                }}
              >
                Open Trello card
              </a>
            ) : null}
          </>
        ) : (
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            No Trello card matched
          </div>
        )}
      </div>
    </div>
  );
}