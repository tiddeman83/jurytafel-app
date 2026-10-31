/**
 * Zuivere wedstrijdlogica. Geen DOM, geen opslag.
 * Tijden zijn milliseconden. `now` is een timestamp zodat tests en een
 * vergrendeld scherm dezelfde klok houden.
 */

export const SCHEMA = 2;
export const APP_VERSION = '2.0.4';

export const LIMITS = {
  S: { to: 2, sub: 8, officialShot: true, pen: true },
  A: { to: 2, sub: 8, officialShot: false, pen: false },
  B: { to: 0, sub: Infinity, officialShot: false, pen: false },
};

const PEN_MS = 4 * 60 * 1000;
const TO_MS = 60 * 1000;

export function defaultState() {
  const half = 25 * 60 * 1000;
  return {
    schema: SCHEMA,
    mode: 'jury',
    coachTeam: 0,
    set: { type: 'S', tA: 'Thuis', tB: 'Uit', half: 25, rust: 10, tto: false, shotDur: 25 },
    players: [[], []],
    score: [0, 0],
    per: 0,
    periodMs: half,
    cumBase: 0,
    clk: half,
    run: false,
    runAt: 0,
    shot: 25 * 1000,
    shotRun: false,
    shotAt: 0,
    shotResume: false,
    shotHist: [],
    to: [0, 0],
    toEnd: 0,
    subs: [0, 0],
    pens: [],
    log: [],
    chk: {},
    savedAt: 0,
  };
}

export function limits(s) {
  return LIMITS[s?.set?.type] || LIMITS.S;
}

export function uid() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampInt(v, min, max, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function teamName(s, i) {
  const raw = i ? s.set.tB : s.set.tA;
  const t = String(raw || '').trim();
  return t || (i ? 'Uit' : 'Thuis');
}

export function periodList(s) {
  const half = clampInt(s.set.half, 1, 60, 25) * 60 * 1000;
  const rustMin = clampInt(s.set.rust, 1, 30, 10);
  const rust = Math.max(0, rustMin - 1) * 60 * 1000;
  if (s.set.tto) {
    return [
      ['1e helft, deel 1', half / 2],
      ['1e helft, deel 2', half / 2],
      ['Rust', rust],
      ['2e helft, deel 1', half / 2],
      ['2e helft, deel 2', half / 2],
    ];
  }
  return [
    ['1e helft', half],
    ['Rust', rust],
    ['2e helft', half],
  ];
}

function periodIndex(s) {
  const list = periodList(s);
  return Math.min(Math.max(0, s.per || 0), list.length - 1);
}

export function periodName(s) {
  return periodList(s)[periodIndex(s)][0];
}

export function isRust(s, i = s.per) {
  const list = periodList(s);
  const idx = Math.min(Math.max(0, i || 0), list.length - 1);
  return list[idx][0] === 'Rust';
}

export function playingPeriodMs(s) {
  const half = clampInt(s.set.half, 1, 60, 25) * 60 * 1000;
  return s.set.tto ? half / 2 : half;
}

export function clkRemaining(s, now) {
  if (!s.run || !s.runAt) return Math.max(0, num(s.clk));
  return Math.max(0, num(s.clk) - (now - s.runAt));
}

export function shotRemaining(s, now) {
  if (!s.shotRun || !s.shotAt) return Math.max(0, num(s.shot));
  return Math.max(0, num(s.shot) - (now - s.shotAt));
}

export function elapsedPeriod(s, now) {
  return Math.max(0, num(s.periodMs) - clkRemaining(s, now));
}

/** Cumulatieve zuivere speeltijd, rust telt niet mee. */
export function played(s, now) {
  if (isRust(s)) return num(s.cumBase);
  return num(s.cumBase) + elapsedPeriod(s, now);
}

/** Lopende minuut: 00:00–00:59 is 1', 35:00 is 36'. */
export function minuteMark(s, now) {
  return Math.floor(played(s, now) / 60000) + 1;
}

export function fmtUp(ms) {
  const total = Math.max(0, Math.floor(num(ms) / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

export function fmtDown(ms) {
  const total = Math.ceil(Math.max(0, num(ms)) / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
}

export function parseTime(v) {
  if (v == null) return null;
  const t = String(v).trim();
  if (!t) return null;
  if (t.includes(':')) {
    const [a, b] = t.split(':');
    const m = Number(a);
    const sec = Number(b);
    if (!Number.isFinite(m) || !Number.isFinite(sec) || m < 0 || sec < 0 || sec >= 60) return null;
    return Math.round((m * 60 + sec) * 1000);
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 60 * 1000);
}

export function stamp(s, now) {
  const wall = new Date(now).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${minuteMark(s, now)}' (${fmtUp(played(s, now))}) · ${wall} · ${periodName(s)}`;
}

export function pushLog(s, now, msg) {
  s.log.unshift(`${stamp(s, now)} — ${msg}`);
  if (s.log.length > 500) s.log.length = 500;
  return s;
}

export function timeoutLeft(s, now) {
  return Math.max(0, num(s.toEnd) - now);
}

function matchUsed(s) {
  return !!(
    (s.log && s.log.length)
    || s.score?.[0]
    || s.score?.[1]
    || s.subs?.[0]
    || s.subs?.[1]
    || s.to?.[0]
    || s.to?.[1]
    || (s.pens && s.pens.length)
    || s.cumBase
    || s.run
    || s.per > 0
  );
}

function normalizePlayers(raw) {
  const out = [[], []];
  if (!Array.isArray(raw)) return out;
  for (let t = 0; t < 2; t += 1) {
    const list = Array.isArray(raw[t]) ? raw[t] : [];
    for (const p of list) {
      if (!p || typeof p !== 'object') continue;
      out[t].push({
        id: String(p.id || uid()),
        nr: String(p.nr ?? '').slice(0, 4),
        name: String(p.name ?? '').slice(0, 40),
        on: !!p.on,
        played: num(p.played),
        since: num(p.since),
      });
    }
  }
  return out;
}

function normalizePens(raw, running, now) {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => ({
    team: p.team === 1 ? 1 : 0,
    who: p.who || 'speler',
    nm: String(p.nm || '?').slice(0, 40),
    c: p.c === 'rood' ? 'rood' : 'geel',
    left: Math.max(0, num(p.left)),
    syncAt: p.syncAt ? num(p.syncAt) : (running && num(p.left) > 0 ? now : 0),
  }));
}

/**
 * Oude installs zonder schema krijgen neutrale namen zolang de wedstrijd
 * nog leeg is. Een begonnen wedstrijd houdt de ingevulde namen.
 */
export function migrate(raw) {
  if (!raw || typeof raw !== 'object') return defaultState();
  const d = defaultState();
  const set = raw.set || {};
  d.set.type = LIMITS[set.type] ? set.type : 'S';
  d.set.half = clampInt(set.half, 1, 60, 25);
  d.set.rust = clampInt(set.rust, 1, 30, 10);
  d.set.tto = !!set.tto;
  d.set.shotDur = clampInt(set.shotDur ?? 25, 5, 60, 25);
  d.mode = raw.mode === 'coach' ? 'coach' : 'jury';
  d.coachTeam = raw.coachTeam === 1 ? 1 : 0;
  d.score = [Math.max(0, num(raw.score?.[0])), Math.max(0, num(raw.score?.[1]))];
  d.per = Math.max(0, num(raw.per));
  d.cumBase = Math.max(0, num(raw.cumBase));
  d.run = !!raw.run && !!raw.runAt;
  d.runAt = d.run ? num(raw.runAt) : 0;
  d.clk = raw.clk == null ? playingPeriodMs(d) : Math.max(0, num(raw.clk));
  d.shotRun = !!raw.shotRun && !!raw.shotAt;
  d.shotAt = d.shotRun ? num(raw.shotAt) : 0;
  d.shotResume = !!raw.shotResume && !d.shotRun;
  d.shot = raw.shot == null ? d.set.shotDur * 1000 : Math.max(0, num(raw.shot));
  d.shotHist = Array.isArray(raw.shotHist) ? raw.shotHist.slice(0, 5).map((h) => ({
    beforeMs: Math.max(0, num(h.beforeMs)),
    wasRunning: !!h.wasRunning,
    matchMs: Math.max(0, num(h.matchMs)),
    minute: num(h.minute) || 1,
    action: String(h.action || 'reset'),
    at: num(h.at),
  })) : [];
  d.to = [Math.max(0, num(raw.to?.[0])), Math.max(0, num(raw.to?.[1]))];
  d.toEnd = num(raw.toEnd);
  d.subs = [Math.max(0, num(raw.subs?.[0])), Math.max(0, num(raw.subs?.[1]))];
  d.log = Array.isArray(raw.log) ? raw.log.map(String).slice(0, 500) : [];
  d.chk = raw.chk && typeof raw.chk === 'object' ? { ...raw.chk } : {};
  d.players = normalizePlayers(raw.players);
  d.pens = normalizePens(raw.pens, d.run, d.runAt || Date.now());
  d.savedAt = num(raw.savedAt);

  const legacy = raw.schema !== SCHEMA;
  const keepNames = !legacy || matchUsed(raw);
  d.set.tA = keepNames && set.tA ? String(set.tA).slice(0, 32) : 'Thuis';
  d.set.tB = keepNames && set.tB ? String(set.tB).slice(0, 32) : 'Uit';

  if (raw.periodMs == null) {
    const list = periodList(d);
    if (raw.cumBase == null) {
      let base = 0;
      for (let i = 0; i < d.per && i < list.length; i += 1) {
        if (list[i][0] !== 'Rust') base += list[i][1];
      }
      d.cumBase = base;
    }
    d.periodMs = list[Math.min(d.per, list.length - 1)][1];
  } else {
    d.periodMs = Math.max(0, num(raw.periodMs));
  }
  if (d.per >= periodList(d).length) d.per = periodList(d).length - 1;
  d.schema = SCHEMA;
  return d;
}

export function findPlayer(s, id) {
  for (const team of s.players) {
    const p = team.find((x) => x.id === id);
    if (p) return p;
  }
  return null;
}

export function playerLabel(p) {
  if (!p) return '?';
  return [p.nr, p.name].filter(Boolean).join(' ') || '?';
}

export function playerTime(p, s, now) {
  if (!p) return 0;
  let t = num(p.played);
  if (p.on && p.since && s.run) t += Math.max(0, now - p.since);
  return Math.max(0, t);
}

export function setPlayerOn(s, now, id, on) {
  const p = findPlayer(s, id);
  if (!p || p.on === !!on) return s;
  if (p.on && p.since) p.played = num(p.played) + Math.max(0, now - p.since);
  p.since = 0;
  p.on = !!on;
  if (p.on && s.run) p.since = now;
  return s;
}

export function addPlayer(s, team, nr, name) {
  const item = {
    id: uid(),
    nr: String(nr || '').trim().slice(0, 4),
    name: String(name || '').trim().slice(0, 40),
    on: false,
    played: 0,
    since: 0,
  };
  if (!item.nr && !item.name) return null;
  s.players[team === 1 ? 1 : 0].push(item);
  return item;
}

export function removePlayer(s, id) {
  for (const team of s.players) {
    const i = team.findIndex((p) => p.id === id);
    if (i >= 0) team.splice(i, 1);
  }
  return s;
}

export function fairness(s, now, team) {
  const ps = s.players[team] || [];
  if (!ps.length) return null;
  const rows = ps.map((p) => ({ p, t: playerTime(p, s, now) }));
  const avg = rows.reduce((sum, row) => sum + row.t, 0) / rows.length;
  let low = rows[0];
  for (const row of rows) if (row.t < low.t) low = row;
  return { avg, low, rows };
}

function freezePlayers(s, now) {
  for (const team of s.players) {
    for (const p of team) {
      if (p.on && p.since) {
        p.played = num(p.played) + Math.max(0, now - p.since);
        p.since = 0;
      }
    }
  }
}

function resumePlayers(s, now) {
  for (const team of s.players) {
    for (const p of team) if (p.on) p.since = now;
  }
}

function commitPens(s, now) {
  for (const p of s.pens) {
    if (p.left > 0 && p.syncAt) {
      p.left = Math.max(0, p.left - (now - p.syncAt));
      p.syncAt = 0;
    }
  }
}

function armPens(s, now) {
  for (const p of s.pens) if (p.left > 0) p.syncAt = now;
}

export function penRemaining(p, s, now) {
  if (!p || p.left <= 0) return 0;
  if (s.run && p.syncAt) return Math.max(0, p.left - (now - p.syncAt));
  return p.left;
}

export function stopClock(s, now) {
  if (!s.run) return s;
  if (s.shotRun) {
    const left = shotRemaining(s, now);
    s.shot = left;
    s.shotRun = false;
    s.shotAt = 0;
    s.shotResume = left > 0;
  }
  const rem = clkRemaining(s, now);
  freezePlayers(s, now);
  commitPens(s, now);
  s.clk = rem;
  s.run = false;
  s.runAt = 0;
  return s;
}

export function startClock(s, now) {
  if (s.run) return { ok: true, started: false };
  if (clkRemaining(s, now) <= 0) return { ok: false, reason: 'zero', started: false };
  s.runAt = now;
  s.run = true;
  resumePlayers(s, now);
  armPens(s, now);
  if (s.shotResume && shotRemaining(s, now) > 0) {
    s.shotAt = now;
    s.shotRun = true;
    s.shotResume = false;
  }
  return { ok: true, started: true };
}

export function adjustClock(s, now, deltaMs) {
  s.clk = Math.max(0, clkRemaining(s, now) + deltaMs);
  if (s.run) s.runAt = now;
  return s;
}

export function setRemaining(s, now, ms) {
  s.clk = Math.max(0, num(ms));
  if (s.run) s.runAt = now;
  return s;
}

export function setElapsed(s, now, ms) {
  const elapsed = Math.max(0, num(ms));
  if (elapsed > s.periodMs) s.periodMs = elapsed;
  s.clk = Math.max(0, s.periodMs - elapsed);
  if (s.run) s.runAt = now;
  return s;
}

function untouched(s) {
  return !s.run && !s.log.length && !s.cumBase && s.per === 0 && !s.score[0] && !s.score[1];
}

export function setHalf(s, minutes) {
  s.set.half = clampInt(minutes, 1, 60, 25);
  if (untouched(s)) {
    const ms = playingPeriodMs(s);
    s.periodMs = ms;
    s.clk = ms;
  }
  return s;
}

export function setRust(s, minutes) {
  s.set.rust = clampInt(minutes, 1, 30, 10);
  return s;
}

export function setTto(s, on) {
  s.set.tto = !!on;
  if (untouched(s)) {
    s.per = 0;
    const ms = playingPeriodMs(s);
    s.periodMs = ms;
    s.clk = ms;
  } else if (s.per >= periodList(s).length) {
    s.per = periodList(s).length - 1;
  }
  return s;
}

export function setType(s, type) {
  if (LIMITS[type]) s.set.type = type;
  return s;
}

export function setShotDur(s, sec) {
  const prev = s.set.shotDur;
  const n = clampInt(sec, 5, 60, 25);
  s.set.shotDur = n;
  if (!s.shotRun && Math.abs(num(s.shot) - prev * 1000) < 50) s.shot = n * 1000;
  return s;
}

export function startShot(s, now) {
  if (!s.shotRun) {
    if (shotRemaining(s, now) <= 0) s.shot = s.set.shotDur * 1000;
    s.shotAt = now;
    s.shotRun = true;
  }
  s.shotResume = false;
  let startedMatch = false;
  if (!s.run) {
    const res = startClock(s, now);
    startedMatch = !!res.started;
  }
  return { startedMatch };
}

export function stopShot(s, now) {
  if (!s.shotRun) return s;
  s.shot = shotRemaining(s, now);
  s.shotRun = false;
  s.shotAt = 0;
  s.shotResume = false;
  return s;
}

function pushShotHist(s, entry) {
  if (!Array.isArray(s.shotHist)) s.shotHist = [];
  s.shotHist.unshift(entry);
  if (s.shotHist.length > 5) s.shotHist.length = 5;
}

export function resetShot(s, now, { start = false, action = 'reset' } = {}) {
  pushShotHist(s, {
    beforeMs: shotRemaining(s, now),
    wasRunning: !!s.shotRun,
    matchMs: played(s, now),
    minute: minuteMark(s, now),
    action,
    at: now,
  });
  s.shot = s.set.shotDur * 1000;
  s.shotRun = false;
  s.shotAt = 0;
  s.shotResume = false;
  let startedMatch = false;
  if (start) {
    s.shotAt = now;
    s.shotRun = true;
    if (!s.run) {
      const res = startClock(s, now);
      startedMatch = !!res.started;
    }
  }
  return { startedMatch };
}

export function restoreShot(s, now, index) {
  const entry = s.shotHist?.[index];
  if (!entry) return { ok: false };
  pushShotHist(s, {
    beforeMs: shotRemaining(s, now),
    wasRunning: !!s.shotRun,
    matchMs: played(s, now),
    minute: minuteMark(s, now),
    action: 'herstel',
    at: now,
  });
  s.shot = entry.beforeMs;
  s.shotRun = false;
  s.shotAt = 0;
  s.shotResume = false;
  let startedMatch = false;
  if (entry.wasRunning && entry.beforeMs > 0) {
    s.shotAt = now;
    s.shotRun = true;
    if (!s.run) {
      const res = startClock(s, now);
      startedMatch = !!res.started;
    }
  }
  return { ok: true, startedMatch };
}

function expirePens(s, now, events) {
  if (!s.run) return;
  for (const p of s.pens) {
    if (p.left <= 0 || !p.syncAt) continue;
    if (p.left - (now - p.syncAt) <= 0) {
      p.left = 0;
      p.syncAt = 0;
      events.push({ type: 'pen', pen: p });
    }
  }
}

/** Haal verlopen klok, straf en schotklok bij op basis van timestamps. */
export function syncTo(s, now) {
  const events = [];
  if (s.run && s.runAt) {
    const endAt = s.runAt + s.clk;
    if (now >= endAt) {
      expirePens(s, endAt, events);
      const name = periodName(s);
      stopClock(s, endAt);
      s.clk = 0;
      events.push({ type: 'period', name });
    } else {
      expirePens(s, now, events);
    }
  }
  if (s.shotRun && s.shotAt && now >= s.shotAt + s.shot) {
    s.shot = 0;
    s.shotRun = false;
    s.shotAt = 0;
    s.shotResume = false;
    events.push({ type: 'shot' });
  }
  return events;
}

export function nextPeriod(s, now) {
  const list = periodList(s);
  if (s.per >= list.length - 1) return { ok: false, reason: 'end' };
  const ended = periodName(s);
  if (!isRust(s)) {
    const playedThis = Math.max(0, num(s.periodMs) - clkRemaining(s, now));
    stopClock(s, now);
    s.cumBase = num(s.cumBase) + playedThis;
    s.clk = s.periodMs;
    s.run = false;
    s.runAt = 0;
  } else {
    stopClock(s, now);
  }
  pushLog(s, now, `Einde ${ended} — stand ${s.score.join('-')}`);
  s.per += 1;
  const np = periodList(s)[s.per];
  s.periodMs = np[1];
  s.clk = np[1];
  s.run = false;
  s.runAt = 0;
  resetShot(s, now, { start: false, action: 'periode' });
  const note = np[0] === 'Rust' ? ' (bord telt de rust één minuut korter af)' : '';
  pushLog(s, now, `Begin ${np[0]}${note}`);
  return { ok: true };
}

export function addGoal(s, now, team, delta) {
  const i = team === 1 ? 1 : 0;
  const d = delta < 0 ? -1 : 1;
  s.score[i] = Math.max(0, num(s.score[i]) + d);
  if (d > 0) {
    if (s.run) stopClock(s, now);
    resetShot(s, now, { start: false, action: 'doelpunt' });
    pushLog(s, now, `Doelpunt ${teamName(s, i)} → ${s.score.join('-')}`);
  } else {
    pushLog(s, now, `Correctie score ${teamName(s, i)} → ${s.score.join('-')}`);
  }
  return s;
}

export function assessTimeout(s, now, team) {
  const lim = limits(s);
  if (!lim.to) return { ok: false, reason: 'none' };
  if (s.to[team] >= lim.to) return { ok: false, reason: 'max', max: lim.to };
  const blocked = s.pens.some((p) => p.team === team && p.who !== 'speler' && penRemaining(p, s, now) > 0);
  return { ok: true, blocked, max: lim.to, left: lim.to - s.to[team] };
}

export function applyTimeout(s, now, team) {
  const lim = limits(s);
  s.to[team] += 1;
  s.toEnd = now + TO_MS;
  if (s.run) stopClock(s, now);
  const max = lim.to ? `/${lim.to}` : '';
  pushLog(s, now, `Time-out ${teamName(s, team)} (${s.to[team]}${max})`);
  return s;
}

export function assessSub(s, now, team) {
  const lim = limits(s);
  const blocked = s.pens.some((p) => p.team === team && p.who !== 'speler' && penRemaining(p, s, now) > 0);
  return {
    over: lim.sub !== Infinity && s.subs[team] >= lim.sub,
    max: lim.sub,
    blocked,
    count: s.subs[team],
  };
}

export function applySub(s, now, { team, inLabel, outLabel, inId, outId }) {
  const i = team === 1 ? 1 : 0;
  if (outId) setPlayerOn(s, now, outId, false);
  if (inId) setPlayerOn(s, now, inId, true);
  s.subs[i] += 1;
  const lim = limits(s);
  const limTxt = lim.sub === Infinity ? '' : `/${lim.sub}`;
  pushLog(s, now, `Wissel ${teamName(s, i)} (${s.subs[i]}${limTxt}): IN ${inLabel || '?'} – UIT ${outLabel || '?'}`);
  return s;
}

export function assessCard(s, { team, name, color }) {
  const second = color === 'geel' && s.pens.some((p) => p.team === team && p.nm === name && p.c === 'geel');
  return { second: !!second };
}

export function applyCard(s, now, { team, who, name, color }) {
  const i = team === 1 ? 1 : 0;
  const c = color === 'rood' ? 'rood' : 'geel';
  const whoKey = who || 'speler';
  const nm = name || '?';
  if (limits(s).pen && (c === 'geel' || (c === 'rood' && whoKey !== 'speler'))) {
    s.pens.push({
      team: i,
      who: whoKey,
      nm,
      c,
      left: PEN_MS,
      syncAt: s.run ? now : 0,
    });
  }
  let extra = '';
  if (c === 'rood' && whoKey === 'speler') extra = ' – vervangen, registreer die wissel';
  if (c === 'rood' && whoKey !== 'speler') extra = ' – geen coaching; na 4 min mag de aanvoerder time-out en wissel vragen';
  const word = c === 'rood' ? 'ROOD' : 'GEEL';
  pushLog(s, now, `${word} ${whoKey} ${teamName(s, i)} ${nm}${extra}`);
  return s;
}

export function isMatchDirty(s) {
  return matchUsed(s);
}

export function freshMatch(s) {
  const n = defaultState();
  n.set = structuredClone(s.set);
  n.mode = s.mode;
  n.coachTeam = s.coachTeam;
  n.players = s.players.map((team) => team.map((p) => ({
    id: p.id,
    nr: p.nr,
    name: p.name,
    on: false,
    played: 0,
    since: 0,
  })));
  const ms = playingPeriodMs(n);
  n.periodMs = ms;
  n.clk = ms;
  n.shot = n.set.shotDur * 1000;
  return n;
}

export function makeArchiveItem(s, now) {
  return {
    id: uid(),
    at: now,
    tA: teamName(s, 0),
    tB: teamName(s, 1),
    score: [...s.score],
    playedMs: played(s, now),
    type: s.set.type,
    state: structuredClone(s),
  };
}

export function buildReport(s, now) {
  const lines = [];
  const role = s.mode === 'coach' ? 'Coach' : 'Jurytafel';
  lines.push(`${role} ${teamName(s, 0)} – ${teamName(s, 1)} (${new Date(now).toLocaleDateString('nl-NL')})`);
  lines.push(`Stand ${s.score.join('-')} | time-outs ${s.to.join('/')} | wissels ${s.subs.join('/')}`);
  lines.push(`Totaal gespeeld ${fmtUp(played(s, now))}`);
  for (let i = 0; i < 2; i += 1) {
    if (!s.players[i].length) continue;
    lines.push('');
    lines.push(teamName(s, i));
    for (const p of s.players[i]) {
      lines.push(`${playerLabel(p)}: ${fmtUp(playerTime(p, s, now))}${p.on ? ' (veld)' : ''}`);
    }
  }
  if (s.shotHist?.length) {
    lines.push('');
    lines.push('Schotklok, laatste resets');
    for (const h of s.shotHist) {
      lines.push(`${Math.ceil(h.beforeMs / 1000)}s voor ${h.action} · ${fmtUp(h.matchMs)} · ${h.minute}'`);
    }
  }
  lines.push('');
  lines.push(...[...s.log].reverse());
  return lines.join('\n');
}

export function exportBundle(current, archive, now) {
  return {
    app: 'jurytafel',
    version: APP_VERSION,
    schema: SCHEMA,
    exportedAt: new Date(now).toISOString(),
    current,
    archive,
  };
}

export function importBundle(data) {
  if (!data || data.app !== 'jurytafel' || !data.current) {
    throw new Error('ongeldig');
  }
  const archive = Array.isArray(data.archive)
    ? data.archive.filter((item) => item && item.state).map((item) => ({
      ...item,
      state: migrate(item.state),
    }))
    : [];
  return { current: migrate(data.current), archive };
}
