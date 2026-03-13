const TRELLO_BASE = "https://api.trello.com/1";

function requireEnv(name) {
  // eslint-disable-next-line no-undef
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function getAuthParams() {
  return new URLSearchParams({
    key: requireEnv("TRELLO_KEY"),
    token: requireEnv("TRELLO_TOKEN"),
  });
}

async function trelloGet(path, extraParams = {}) {
  const params = getAuthParams();

  for (const [k, v] of Object.entries(extraParams)) {
    if (v !== undefined && v !== null) {
      params.set(k, String(v));
    }
  }

  const url = `${TRELLO_BASE}${path}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fetchBoardLists(boardId) {
  return trelloGet(`/boards/${boardId}/lists`, {
    fields: "name",
    filter: "open",
  });
}

export async function fetchBoardCards(boardId) {
  return trelloGet(`/boards/${boardId}/cards`, {
    fields: "name,idList,labels,due,url,shortUrl,shortLink,closed",
    filter: "open",
  });
}

export async function fetchBoardCardsWithLists(boardId) {
  const [lists, cards] = await Promise.all([
    fetchBoardLists(boardId),
    fetchBoardCards(boardId),
  ]);

  const listMap = new Map(
    lists.map(list => [list.id, list.name])
  );

  return cards.map(card => ({
    cardId: card.id,
    cardName: card.name,
    listId: card.idList,
    list: listMap.get(card.idList) || "Unknown",
    labels: Array.isArray(card.labels)
      ? card.labels.map(l => l.name || l.color).filter(Boolean)
      : [],
    due: card.due || null,
    url: card.url || card.shortUrl || null,
    shortLink: card.shortLink || null,
    closed: Boolean(card.closed),
  }));
}