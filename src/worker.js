// Giveback Pool: serves the game page and the API that reads and writes the D1 database.
// Routes: / and /join serve the page (the same file; the page picks teacher or student by URL);
// /api/* is the API.

import INDEX_HTML from "./index.html";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const MAX_GROUPS = 5;
const PLAN_KEYS = ["low", "standard", "high"];
const CLAIM_KEYS = ["full", "half", "deny"];
const ID_RE = /^[a-z0-9]{6,40}$/;

function isHost(request, env) {
  const code = request.headers.get("x-host-code");
  return Boolean(env.HOST_CODE) && typeof code === "string" && code.length > 0 && code === env.HOST_CODE;
}

async function loadState(env) {
  const row = await env.DB.prepare("SELECT state FROM game WHERE id = 1").first();
  return row ? JSON.parse(row.state) : null;
}

async function getState(request, env, url) {
  const host = isHost(request, env);
  const pid = url.searchParams.get("pid") || "";
  const state = await loadState(env);
  if (!state) return json({ state: null, host });

  const out = { state, host, me: null, mine: [] };

  if (ID_RE.test(pid)) {
    const me = await env.DB.prepare("SELECT name FROM players WHERE pid = ? AND session = ?")
      .bind(pid, state.session).first();
    if (me) out.me = { name: me.name };
    const mine = await env.DB.prepare(
      "SELECT kind, choice FROM ballots WHERE session = ? AND round = ? AND pid = ?"
    ).bind(state.session, state.round, pid).all();
    out.mine = mine.results;
  }

  if (host) {
    const players = await env.DB.prepare("SELECT pid, name FROM players WHERE session = ? ORDER BY joined")
      .bind(state.session).all();
    const ballots = await env.DB.prepare(
      "SELECT pid, kind, choice FROM ballots WHERE session = ? AND round = ?"
    ).bind(state.session, state.round).all();
    out.players = players.results;
    out.ballots = ballots.results;
  }
  return json(out);
}

async function join(request, env) {
  const body = await request.json();
  const pid = String(body.pid || "");
  const name = String(body.name || "").trim().slice(0, 24);
  if (!ID_RE.test(pid) || !name) return json({ error: "bad_request" }, 400);
  const state = await loadState(env);
  if (!state) return json({ error: "no_game" }, 409);
  if (state.status !== "lobby") return json({ error: "already_started" }, 409);
  // Only MAX_GROUPS groups can join. A group that already joined may rejoin.
  const seen = await env.DB.prepare("SELECT 1 AS x FROM players WHERE pid = ? AND session = ?")
    .bind(pid, state.session).first();
  if (!seen) {
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM players WHERE session = ?")
      .bind(state.session).first();
    if (count.n >= MAX_GROUPS) return json({ error: "class_full" }, 409);
  }
  await env.DB.prepare(
    "INSERT INTO players (pid, session, name, joined) VALUES (?, ?, ?, ?) " +
    "ON CONFLICT(pid) DO UPDATE SET session = excluded.session, name = excluded.name, joined = excluded.joined"
  ).bind(pid, state.session, name, Date.now()).run();
  return json({ ok: true });
}

async function vote(request, env) {
  const body = await request.json();
  const pid = String(body.pid || "");
  const kind = String(body.kind || "");
  const choice = String(body.choice ?? "");
  if (!ID_RE.test(pid)) return json({ error: "bad_request" }, 400);
  const state = await loadState(env);
  if (!state || state.status !== "play") return json({ error: "not_voting" }, 409);

  // Each kind of vote is only open during its phase, and only for valid choices.
  let ok = false;
  if (kind === "plan") ok = state.phase === "price" && PLAN_KEYS.includes(choice);
  else if (/^claim-[a-z0-9]{1,12}$/.test(kind)) ok = state.phase === "claims" && CLAIM_KEYS.includes(choice)
    && state.claims.some(c => `claim-${c.id}` === kind);
  else if (kind === "charity") ok = state.phase === "charity" && /^[0-2]$/.test(choice);
  if (!ok) return json({ error: "not_allowed" }, 409);

  const me = await env.DB.prepare("SELECT 1 AS x FROM players WHERE pid = ? AND session = ?")
    .bind(pid, state.session).first();
  if (!me) return json({ error: "not_joined" }, 403);

  const id = `${state.session}_${state.round}_${kind}_${pid}`;
  await env.DB.prepare(
    "INSERT INTO ballots (id, session, round, kind, pid, choice, at) VALUES (?, ?, ?, ?, ?, ?, ?) " +
    "ON CONFLICT(id) DO UPDATE SET choice = excluded.choice, at = excluded.at"
  ).bind(id, state.session, state.round, kind, pid, choice, Date.now()).run();
  return json({ ok: true });
}

async function hostState(request, env) {
  if (!isHost(request, env)) return json({ error: "not_host" }, 403);
  const next = await request.json();
  if (!next || typeof next.session !== "string" || typeof next.status !== "string") {
    return json({ error: "bad_state" }, 400);
  }
  await env.DB.prepare(
    "INSERT INTO game (id, state) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET state = excluded.state"
  ).bind(JSON.stringify(next)).run();
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/join") {
      return new Response(INDEX_HTML, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }
    if (!url.pathname.startsWith("/api/")) return json({ error: "not_found" }, 404);

    try {
      const path = url.pathname.slice(4);
      const method = request.method;
      if (path === "/state" && method === "GET") return await getState(request, env, url);
      if (path === "/join" && method === "POST") return await join(request, env);
      if (path === "/vote" && method === "POST") return await vote(request, env);
      if (path === "/host/state" && method === "POST") return await hostState(request, env);
      return json({ error: "not_found" }, 404);
    } catch (e) {
      console.error("api error", e && e.stack ? e.stack : e);
      return json({ error: "server_error" }, 500);
    }
  },
};
