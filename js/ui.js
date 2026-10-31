import {
  APP_VERSION,
  addGoal,
  addPlayer,
  adjustClock,
  applyCard,
  applySub,
  applyTimeout,
  assessCard,
  assessSub,
  assessTimeout,
  buildReport,
  clkRemaining,
  elapsedPeriod,
  exportBundle,
  fairness,
  findPlayer,
  fmtDown,
  fmtUp,
  freshMatch,
  importBundle,
  isMatchDirty,
  isRust,
  limits,
  makeArchiveItem,
  migrate,
  minuteMark,
  nextPeriod,
  penRemaining,
  periodName,
  played,
  playerLabel,
  playerTime,
  pushLog,
  removePlayer,
  resetShot,
  restoreShot,
  setElapsed,
  setHalf,
  setPlayerOn,
  setRemaining,
  setRust,
  setShotDur,
  setTto,
  setType,
  shotRemaining,
  startClock,
  startShot,
  stopClock,
  stopShot,
  syncTo,
  teamName,
  timeoutLeft,
  parseTime,
} from './clock.js';
import { CHECKLIST, INSTALL, RULES, SOURCES, WARNING } from './content.js';

const TYPE_LABEL = {
  S: 'Schotklok (zaal)',
  A: 'A-categorie',
  B: 'Breedte / B-categorie',
};

let S;
let archive = [];
let meta = {};
let saveFn = () => {};
let persistFn = async () => ({ persisted: false });
let tab = 'wed';
let histOpen = false;
let sheet = null;
let dlgRes = null;
let toastTimer = 0;
let audioCtx;
let updateAction = null;

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function save() {
  saveFn();
}

export function startUi(initial, hooks) {
  S = initial.current;
  archive = initial.archive || [];
  meta = initial.meta || {};
  saveFn = hooks.save;
  persistFn = hooks.persist;
  bind();
  render();
  maybeInstallBanner();
  persistFn().then((info) => {
    meta.persist = !!info.persisted;
    renderStore(info);
  }).catch(() => {});
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else tick();
  });
  window.addEventListener('pagehide', () => save());
  return {
    snapshot: () => ({ current: S, archive, meta }),
    isRunning: () => !!S.run,
    ask,
    showUpdate,
  };
}

export function showUpdate(action) {
  updateAction = action;
  const el = $('upd');
  if (el) el.hidden = false;
}

function maybeInstallBanner() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const box = $('install');
  if (!box) return;
  if (standalone || meta.installDismissed) {
    box.hidden = true;
    return;
  }
  const host = $('installText');
  host.replaceChildren();
  for (const line of [INSTALL.iphone, INSTALL.android]) {
    const p = document.createElement('p');
    p.textContent = line;
    host.appendChild(p);
  }
  box.hidden = false;
}

function bind() {
  document.body.addEventListener('click', (event) => {
    const b = event.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'dlg-ok') closeDlg(true);
    else if (act === 'dlg-no') closeDlg(false);
    else if (act === 'mode') setMode(b.dataset.mode);
    else if (act === 'coach-team') setCoachTeam(Number(b.dataset.team));
    else if (act === 'new-match') newMatch();
    else if (act === 'toggle-clock') toggleClock();
    else if (act === 'adj') adjustClock(S, Date.now(), Number(b.dataset.ms));
    else if (act === 'apply-rem') applyRem();
    else if (act === 'apply-elap') applyElap();
    else if (act === 'next-period') goNext();
    else if (act === 'goal') onGoal(Number(b.dataset.team), Number(b.dataset.d));
    else if (act === 'timeout') onTimeout(Number(b.dataset.team));
    else if (act === 'shot-start') { startShot(S, Date.now()); save(); render(); }
    else if (act === 'shot-stop') { stopShot(S, Date.now()); save(); render(); }
    else if (act === 'shot-reset') { resetShot(S, Date.now(), { start: false, action: 'reset' }); save(); render(); }
    else if (act === 'shot-reset-go') { resetShot(S, Date.now(), { start: true, action: 'reset+start' }); save(); render(); }
    else if (act === 'shot-dur') setShotDur(S, Number(b.dataset.sec));
    else if (act === 'shot-hist') { histOpen = !histOpen; renderHist(); }
    else if (act === 'shot-restore') { restoreShot(S, Date.now(), Number(b.dataset.i)); save(); render(); toast('Schotklok hersteld'); }
    else if (act === 'quick-sub') openSub(S.mode === 'coach' ? S.coachTeam : 0);
    else if (act === 'quick-card') openCard(S.mode === 'coach' ? S.coachTeam : 0);
    else if (act === 'quick-goal') openGoal();
    else if (act === 'close-sheet') closeSheet();
    else if (act === 'sheet-team') { captureSheet(); sheet.team = Number(b.dataset.team); paintSheet(); }
    else if (act === 'pick-out') { captureSheet(); sheet.outId = b.dataset.id; paintSheet(); }
    else if (act === 'pick-in') { captureSheet(); sheet.inId = b.dataset.id; paintSheet(); }
    else if (act === 'pick-card') { captureSheet(); sheet.playerId = b.dataset.id; paintSheet(); }
    else if (act === 'confirm-sub') confirmSub();
    else if (act === 'confirm-card') confirmCard(b.dataset.color);
    else if (act === 'add-player') onAdd(Number(b.dataset.team));
    else if (act === 'toggle-on') toggleOn(b.dataset.id);
    else if (act === 'del-player') delPlayer(b.dataset.id);
    else if (act === 'share-log') shareLog();
    else if (act === 'save-log') saveLogFile();
    else if (act === 'export-json') exportJson();
    else if (act === 'open-arch') openArchive(b.dataset.id);
    else if (act === 'del-arch') deleteArchive(b.dataset.id);
    else if (act === 'wake') wake();
    else if (act === 'persist') onPersist();
    else if (act === 'dismiss-install') dismissInstall();
    else if (act === 'reload') { if (updateAction) updateAction(); }
    else if (act === 'tab') switchTab(b.dataset.tab);
    if (act === 'adj' || act === 'shot-dur') { save(); render(); }
  });

  document.body.addEventListener('input', (event) => {
    const t = event.target;
    if (t.dataset.teamname != null) {
      if (t.dataset.teamname === '0') S.set.tA = t.value;
      else S.set.tB = t.value;
      document.querySelectorAll(`[data-teamname="${t.dataset.teamname}"]`).forEach((el) => {
        if (el !== t) el.value = t.value;
      });
      save();
      updateTeamLabels();
      return;
    }
    if (t.dataset.pnr || t.dataset.pname) {
      const p = findPlayer(S, t.dataset.pnr || t.dataset.pname);
      if (!p) return;
      if (t.dataset.pnr) p.nr = t.value.slice(0, 4);
      else p.name = t.value.slice(0, 40);
      save();
    }
  });

  document.body.addEventListener('change', (event) => {
    const t = event.target;
    if (t.dataset.chk) {
      S.chk[t.dataset.chk] = t.checked;
      save();
      return;
    }
    if (t.id === 'half') setHalf(S, t.value);
    else if (t.id === 'rust') setRust(S, t.value);
    else if (t.id === 'type') setType(S, t.value);
    else if (t.id === 'shotDur') setShotDur(S, t.value);
    else if (t.id === 'tto') setTto(S, t.checked);
    else if (t.id === 'importFile') {
      const file = t.files && t.files[0];
      t.value = '';
      if (file) importFile(file);
      return;
    } else return;
    save();
    render();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.id && event.target.id.startsWith('addName')) {
      onAdd(Number(event.target.id.slice(-1)));
    }
    if (event.key !== 'Escape') return;
    if (!$('dlg').hidden) closeDlg(false);
    else if (!$('sheet').hidden) closeSheet();
  });
}

function tick() {
  const now = Date.now();
  const events = syncTo(S, now);
  if (!events.length) {
    renderClocks();
    return;
  }
  for (const ev of events) {
    if (ev.type === 'period') {
      pushLog(S, now, `Einde ${ev.name} (tijd)`);
      beep();
    } else if (ev.type === 'pen') {
      pushLog(S, now, `Straftijd voorbij: ${ev.pen.nm} ${teamName(S, ev.pen.team)}`);
      beep();
    } else if (ev.type === 'shot') beep();
  }
  save();
  render();
}

function render() {
  $('modeJury').classList.toggle('on', S.mode !== 'coach');
  $('modeCoach').classList.toggle('on', S.mode === 'coach');
  $('modeJury').setAttribute('aria-pressed', S.mode !== 'coach' ? 'true' : 'false');
  $('modeCoach').setAttribute('aria-pressed', S.mode === 'coach' ? 'true' : 'false');
  $('coachBar').hidden = S.mode !== 'coach';
  $('ct0').classList.toggle('on', S.coachTeam === 0);
  $('ct1').classList.toggle('on', S.coachTeam === 1);
  setVal('half', S.set.half);
  setVal('rust', S.set.rust);
  setVal('shotDur', S.set.shotDur);
  setVal('type', S.set.type);
  const tto = $('tto');
  if (tto && document.activeElement !== tto) tto.checked = !!S.set.tto;
  document.querySelectorAll('[data-teamname]').forEach((el) => {
    if (document.activeElement === el) return;
    const value = el.dataset.teamname === '1' ? S.set.tB : S.set.tA;
    if (el.value !== value) el.value = value;
  });
  updateTeamLabels();
  renderClocks();
  renderRoster();
  renderLog();
  renderChecklist();
  renderArchive();
  renderRules();
  renderHist();
  const ver = $('ver');
  if (ver) ver.textContent = `Versie ${APP_VERSION}`;
}

function renderClocks() {
  const now = Date.now();
  const rem = clkRemaining(S, now);
  const shot = shotRemaining(S, now);
  $('sA').textContent = String(S.score[0]);
  $('sB').textContent = String(S.score[1]);
  $('perLbl').textContent = periodName(S);
  $('minLbl').textContent = isRust(S) ? 'rust' : `min ${minuteMark(S, now)}'`;
  $('clk').textContent = fmtDown(rem);
  $('clk').setAttribute('aria-label', `Resterend ${fmtDown(rem)}, gespeeld ${fmtUp(elapsedPeriod(S, now))}, totaal ${fmtUp(played(S, now))}`);
  $('clk').classList.toggle('low', S.run && rem > 0 && rem < 60000);
  $('elap').textContent = fmtUp(elapsedPeriod(S, now));
  $('tot').textContent = fmtUp(played(S, now));
  $('elapLbl').textContent = isRust(S) ? 'rust verstreken' : 'gespeeld helft';
  const running = !!S.run;
  $('clkBtn').textContent = running ? 'STOP' : 'START';
  $('clkBtn').className = running ? 'r xl' : 'g xl';
  $('clkBtn').setAttribute('aria-pressed', running ? 'true' : 'false');
  $('qClk').textContent = running ? 'STOP' : 'START';
  $('qClk').className = running ? 'r' : 'g';
  $('qClk').setAttribute('aria-pressed', running ? 'true' : 'false');
  const sec = Math.ceil(shot / 1000);
  $('shot').textContent = String(sec);
  $('shot').classList.toggle('low', S.shotRun && sec <= 5);
  $('qShotN').textContent = String(sec);
  $('qShot').setAttribute('aria-label', `Schotklok reset en start, nu ${sec} seconden`);
  $('shotHint').textContent = 'Eigen schotklok';
  paintTo($('toA'), 0);
  paintTo($('toB'), 1);
  const toLeft = timeoutLeft(S, now);
  const toLive = $('toLive');
  if (toLeft > 0) {
    toLive.hidden = false;
    const s = Math.ceil(toLeft / 1000);
    toLive.textContent = s <= 10 ? `Time-out ${s}s · fluit` : `Time-out ${s}s`;
  } else toLive.hidden = true;
  const penLive = $('penLive');
  if (!S.pens.length) penLive.hidden = true;
  else {
    penLive.hidden = false;
    penLive.innerHTML = S.pens.map((p) => {
      const left = penRemaining(p, S, now);
      return `<div class="pen${left <= 0 ? ' done' : ''}"><span>${p.c === 'rood' ? 'Rood' : 'Geel'} ${esc(teamName(S, p.team))} ${esc(p.nm)}</span><b>${fmtDown(left)}</b></div>`;
    }).join('');
  }
  document.querySelectorAll('[data-ptime]').forEach((el) => {
    const p = findPlayer(S, el.dataset.ptime);
    if (p) el.textContent = fmtUp(playerTime(p, S, now));
  });
  document.querySelectorAll('[data-pdelta]').forEach((el) => {
    const p = findPlayer(S, el.dataset.pdelta);
    if (!p) return;
    const team = S.players[0].some((x) => x.id === p.id) ? 0 : 1;
    const fair = fairness(S, now, team);
    if (!fair) return;
    const d = playerTime(p, S, now) - fair.avg;
    el.textContent = `${d >= 0 ? '+' : '−'}${fmtUp(Math.abs(d))}`;
    el.className = d < -30000 ? 'delta low' : d > 30000 ? 'delta high' : 'delta';
  });
  document.querySelectorAll('[data-fair]').forEach((el) => {
    const fair = fairness(S, now, Number(el.dataset.fair));
    if (!fair || fair.rows.length < 2) return;
    el.textContent = `Gemiddeld ${fmtUp(fair.avg)}. Minst gespeeld: ${playerLabel(fair.low.p)}.`;
  });
}

function paintTo(el, team) {
  const lim = limits(S);
  const name = teamName(S, team);
  if (!lim.to) {
    el.textContent = 'Geen TO';
    el.setAttribute('aria-label', `Geen time-out voor ${name} bij dit type`);
    return;
  }
  const left = Math.max(0, lim.to - S.to[team]);
  el.textContent = `TO ${left}`;
  el.setAttribute('aria-label', `Time-out ${name}, nog ${left} van ${lim.to}`);
}

function updateTeamLabels() {
  $('ct0').textContent = teamName(S, 0);
  $('ct1').textContent = teamName(S, 1);
  paintTo($('toA'), 0);
  paintTo($('toB'), 1);
}

function renderRoster() {
  const root = $('roster');
  const active = document.activeElement;
  if (active && root.contains(active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
  const now = Date.now();
  root.innerHTML = [0, 1].map((team) => {
    const rows = S.players[team].map((p) => `<div class="player${p.on ? ' on' : ''}">
      <input data-pnr="${esc(p.id)}" value="${esc(p.nr)}" inputmode="numeric" maxlength="4" aria-label="Rugnummer" autocomplete="off">
      <input data-pname="${esc(p.id)}" value="${esc(p.name)}" maxlength="40" aria-label="Naam" autocomplete="off">
      <b data-ptime="${esc(p.id)}">${fmtUp(playerTime(p, S, now))}</b>
      <span data-pdelta="${esc(p.id)}"></span>
      <button type="button" data-act="toggle-on" data-id="${esc(p.id)}">${p.on ? 'Veld' : 'Bank'}</button>
      <button type="button" class="mini danger" data-act="del-player" data-id="${esc(p.id)}" aria-label="Verwijder ${esc(playerLabel(p))}">×</button>
    </div>`).join('');
    const fair = fairness(S, now, team);
    const showFair = fair && (S.mode !== 'coach' || team === S.coachTeam);
    const fairHtml = showFair
      ? `<p class="fair" data-fair="${team}">${fair.rows.length > 1 ? esc(`Gemiddeld ${fmtUp(fair.avg)}. Minst gespeeld: ${playerLabel(fair.low.p)}.`) : 'Voeg meer spelers toe om speeltijd te vergelijken.'}</p>`
      : '';
    return `<section class="card"><h2>${esc(teamName(S, team))}</h2>
      <label class="src">Ploegnaam<input data-teamname="${team}" value="${esc(team === 1 ? S.set.tB : S.set.tA)}" maxlength="32" autocomplete="off" aria-label="Naam ${team === 1 ? 'uitteam' : 'thuisteam'}"></label>
      <div class="row">
        <input id="addNr${team}" placeholder="Nr" inputmode="numeric" maxlength="4" aria-label="Nieuw rugnummer" autocomplete="off">
        <input id="addName${team}" placeholder="Naam" maxlength="40" aria-label="Nieuwe speler" autocomplete="off">
        <button type="button" class="b" data-act="add-player" data-team="${team}">Voeg toe</button>
      </div>
      ${rows || '<p class="src">Nog geen spelers. Een rugnummer maakt wissels sneller.</p>'}
      ${fairHtml}
    </section>`;
  }).join('');
}

function renderLog() {
  const root = $('log');
  if (!S.log.length) {
    root.textContent = 'Nog geen gebeurtenissen.';
    return;
  }
  root.innerHTML = S.log.map((line) => `<div>${esc(line)}</div>`).join('');
}

function renderChecklist() {
  const root = $('chk');
  if (root.contains(document.activeElement)) return;
  root.replaceChildren();
  for (const group of CHECKLIST) {
    const sec = document.createElement('section');
    const h = document.createElement('h3');
    h.textContent = group.title;
    sec.appendChild(h);
    for (const item of group.items) {
      const label = document.createElement('label');
      label.className = 'chk';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!S.chk[item.id];
      input.dataset.chk = item.id;
      const span = document.createElement('span');
      span.textContent = item.text;
      label.append(input, span);
      sec.appendChild(label);
    }
    root.appendChild(sec);
  }
}

function renderArchive() {
  const root = $('archive');
  if (!archive.length) {
    root.innerHTML = '<p class="src">Nog geen afgeronde wedstrijden. Een nieuwe wedstrijd bewaart de vorige hier.</p>';
    return;
  }
  root.innerHTML = archive.map((item) => {
    const when = new Date(item.at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const score = Array.isArray(item.score) ? item.score.join('-') : '';
    return `<div class="arch"><div><strong>${esc(item.tA)} ${esc(score)} ${esc(item.tB)}</strong><div class="src">${esc(when)} · ${fmtUp(item.playedMs || 0)}</div></div><button type="button" data-act="open-arch" data-id="${esc(item.id)}">Open</button><button type="button" data-act="del-arch" data-id="${esc(item.id)}">Wis</button></div>`;
  }).join('');
}

function renderRules() {
  const root = $('regels');
  if (!root.dataset.ready) {
    root.dataset.ready = '1';
    const intro = document.createElement('p');
    intro.className = 'now';
    intro.innerHTML = 'Nu gekozen: <strong id="rulesNow"></strong>';
    root.appendChild(intro);
    for (const block of RULES) {
      const sec = document.createElement('section');
      sec.className = 'card';
      const h = document.createElement('h2');
      h.textContent = block.title;
      const body = document.createElement('div');
      body.innerHTML = block.html;
      sec.append(h, body);
      root.appendChild(sec);
    }
    const warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = WARNING;
    const src = document.createElement('p');
    src.className = 'src';
    src.textContent = SOURCES;
    root.append(warn, src);
  }
  const now = $('rulesNow');
  if (now) now.textContent = TYPE_LABEL[S.set.type] || S.set.type;
}

function renderHist() {
  const el = $('shotHist');
  const btn = $('shotToggle');
  btn.setAttribute('aria-expanded', histOpen ? 'true' : 'false');
  if (!histOpen) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  if (!S.shotHist.length) {
    el.innerHTML = '<p class="src">Nog geen reset.</p>';
    return;
  }
  el.innerHTML = S.shotHist.map((h, i) => `<div class="hist"><span>${Math.ceil(h.beforeMs / 1000)}s · ${fmtUp(h.matchMs)} · ${h.minute}' · ${esc(h.action)}</span><button type="button" data-act="shot-restore" data-i="${i}">Herstel</button></div>`).join('');
}

function renderStore(info) {
  const el = $('storeStatus');
  if (!el) return;
  if (!meta.idbOk) {
    el.textContent = 'De browserdatabase reageert niet. De huidige stand staat in lokale opslag. Exporteer een back-up.';
    return;
  }
  el.textContent = info?.persisted
    ? 'Alles staat op dit toestel. De browser is gevraagd de gegevens te bewaren.'
    : 'Alles staat op dit toestel. Er is geen server. Bij weinig ruimte kan de browser gegevens wissen. Exporteer een back-up naar Bestanden, iCloud of mail.';
}

function setVal(id, value) {
  const el = $(id);
  if (!el || document.activeElement === el) return;
  if (String(el.value) !== String(value)) el.value = value;
}

function switchTab(name) {
  tab = name;
  for (const id of ['wed', 'spel', 'log', 'regels', 'info']) {
    $(`t-${id}`).hidden = id !== name;
    const btn = $(`tab-${id}`);
    btn.setAttribute('aria-selected', id === name ? 'true' : 'false');
    btn.tabIndex = id === name ? 0 : -1;
  }
  render();
}

function setMode(mode) {
  S.mode = mode === 'coach' ? 'coach' : 'jury';
  save();
  render();
}

function setCoachTeam(team) {
  S.coachTeam = team === 1 ? 1 : 0;
  save();
  render();
}

function toggleClock() {
  const now = Date.now();
  if (S.run) {
    stopClock(S, now);
    pushLog(S, now, 'Klok stop');
  } else {
    const res = startClock(S, now);
    if (!res.ok) {
      toast('Tijd is 0. Zet de tijd of ga naar de volgende periode.');
      return;
    }
    pushLog(S, now, 'Klok start');
  }
  save();
  render();
}

function applyRem() {
  const ms = parseTime($('setRem').value);
  if (ms == null) { toast('Gebruik mm:ss, bijvoorbeeld 12:30.'); return; }
  setRemaining(S, Date.now(), ms);
  $('setRem').value = '';
  save();
  render();
}

function applyElap() {
  const ms = parseTime($('setElap').value);
  if (ms == null) { toast('Gebruik mm:ss, bijvoorbeeld 5:00.'); return; }
  setElapsed(S, Date.now(), ms);
  $('setElap').value = '';
  save();
  render();
}

async function goNext() {
  const listName = periodName(S);
  if (S.per >= (S.set.tto ? 4 : 2)) {
    toast('Dit is de laatste periode.');
    return;
  }
  const ok = await ask(`Naar de volgende periode na ${listName}? Alleen de gespeelde tijd tot nu telt mee.`);
  if (!ok) return;
  const res = nextPeriod(S, Date.now());
  if (!res.ok) { toast('Dit is de laatste periode.'); return; }
  save();
  render();
}

function onGoal(team, delta) {
  addGoal(S, Date.now(), team, delta);
  closeSheet();
  save();
  render();
}

async function onTimeout(team) {
  const now = Date.now();
  const a = assessTimeout(S, now, team);
  if (!a.ok && a.reason === 'none') {
    await note('Dit wedstrijdtype heeft geen time-out. De uitleg staat bij Regels.');
    return;
  }
  if (!a.ok && a.reason === 'max') {
    await note(`${teamName(S, team)} heeft geen time-outs meer (maximaal ${a.max}).`);
    return;
  }
  if (a.blocked) {
    const ok = await ask(`Coach of staf van ${teamName(S, team)} heeft een tijdstraf. Een time-out is dan niet toegestaan. Toch vastleggen?`);
    if (!ok) return;
  }
  const ok = await ask(`Time-out ${teamName(S, team)}? Na het tonen van de kaart is dit definitief.`);
  if (!ok) return;
  applyTimeout(S, Date.now(), team);
  save();
  render();
}

function onAdd(team) {
  const nr = $(`addNr${team}`)?.value || '';
  const name = $(`addName${team}`)?.value || '';
  const item = addPlayer(S, team, nr, name);
  if (!item) { toast('Vul een nummer of een naam in.'); return; }
  document.activeElement?.blur?.();
  save();
  render();
}

function toggleOn(id) {
  const p = findPlayer(S, id);
  if (!p) return;
  const next = !p.on;
  setPlayerOn(S, Date.now(), id, next);
  save();
  render();
  if (isMatchDirty(S)) toast(next ? 'Op het veld. Dit telt niet als wissel.' : 'Op de bank. Dit telt niet als wissel.');
}

async function delPlayer(id) {
  const p = findPlayer(S, id);
  if (!p) return;
  const ok = await ask(`Speler ${playerLabel(p)} verwijderen?`);
  if (!ok) return;
  removePlayer(S, id);
  save();
  render();
}

async function newMatch() {
  const dirty = isMatchDirty(S);
  const ok = await ask(dirty
    ? 'Nieuwe wedstrijd starten? Score, klok, log, kaarten en speeltijden worden gewist. Deze wedstrijd gaat naar het archief. Ploegnamen en spelers blijven.'
    : 'Nieuwe wedstrijd starten? Score en klok worden gewist. Ploegnamen en spelers blijven.');
  if (!ok) return;
  if (dirty) pushArchive(makeArchiveItem(S, Date.now()));
  S = freshMatch(S);
  histOpen = false;
  save();
  render();
  toast('Nieuwe wedstrijd');
}

function pushArchive(item) {
  archive.unshift(item);
  if (archive.length > 80) archive.length = 80;
}

async function openArchive(id) {
  const item = archive.find((a) => a.id === id);
  if (!item) return;
  const ok = await ask('Deze wedstrijd openen? De huidige stand gaat naar het archief als er iets is ingevuld.');
  if (!ok) return;
  const rest = archive.filter((a) => a.id !== id);
  if (isMatchDirty(S)) rest.unshift(makeArchiveItem(S, Date.now()));
  archive.splice(0, archive.length, ...rest.slice(0, 80));
  S = migrate(item.state);
  histOpen = false;
  save();
  render();
  switchTab('wed');
}

async function deleteArchive(id) {
  const ok = await ask('Wedstrijd uit het archief verwijderen?');
  if (!ok) return;
  const i = archive.findIndex((a) => a.id === id);
  if (i >= 0) archive.splice(i, 1);
  save();
  render();
}

async function shareLog() {
  const text = buildReport(S, Date.now());
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Jurytafel logboek', text });
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Logboek gekopieerd');
    return;
  } catch (err) {
    saveLogFile();
  }
}

function saveLogFile() {
  downloadFile('jurytafel-logboek.txt', buildReport(S, Date.now()), 'text/plain');
  toast('Logboek bewaard');
}

async function exportJson() {
  const json = JSON.stringify(exportBundle(S, archive, Date.now()), null, 2);
  const name = `jurytafel-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Jurytafel back-up' });
      return;
    }
  } catch (err) {
    if (err.name === 'AbortError') return;
  }
  downloadFile(name, json, 'application/json');
  toast('Back-up gedownload');
}

async function importFile(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    await note('Dit bestand is geen geldige back-up.');
    return;
  }
  let bundle;
  try {
    bundle = importBundle(data);
  } catch (err) {
    await note('Dit bestand hoort niet bij deze app.');
    return;
  }
  const ok = await ask('Dit bestand vervangt de huidige stand en het archief op dit toestel. Doorgaan?');
  if (!ok) return;
  S = bundle.current;
  archive.splice(0, archive.length, ...bundle.archive.slice(0, 80));
  save();
  render();
  toast('Back-up geladen');
}

function downloadFile(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function openSub(team) {
  sheet = { kind: 'sub', team, outId: null, inId: null, inText: '', outText: '' };
  paintSheet();
}

function openCard(team) {
  sheet = { kind: 'card', team, who: 'speler', playerId: null, name: '' };
  paintSheet();
}

function openGoal() {
  sheet = { kind: 'goal' };
  paintSheet();
}

function captureSheet() {
  if (!sheet) return;
  if ($('sheetWho')) sheet.who = $('sheetWho').value;
  if ($('sheetName')) sheet.name = $('sheetName').value;
  if ($('sheetIn')) sheet.inText = $('sheetIn').value;
  if ($('sheetOut')) sheet.outText = $('sheetOut').value;
}

function paintSheet() {
  const root = $('sheetBody');
  const team = sheet.team ?? 0;
  if (sheet.kind === 'goal') {
    root.innerHTML = `<h2>Doelpunt</h2><div class="row"><button type="button" class="g xl" data-act="goal" data-team="0" data-d="1">+1 ${esc(teamName(S, 0))}</button><button type="button" class="g xl" data-act="goal" data-team="1" data-d="1">+1 ${esc(teamName(S, 1))}</button></div><div class="row"><button type="button" data-act="goal" data-team="0" data-d="-1">−1 ${esc(teamName(S, 0))}</button><button type="button" data-act="goal" data-team="1" data-d="-1">−1 ${esc(teamName(S, 1))}</button></div><button type="button" data-act="close-sheet">Sluiten</button>`;
  } else if (sheet.kind === 'sub') {
    const players = S.players[team];
    const a = assessSub(S, Date.now(), team);
    const lim = a.max === Infinity ? `${a.count}, onbeperkt` : `${a.count} van ${a.max}`;
    const chips = (list, act, selected) => list.map((p) => `<button type="button" class="chip${selected === p.id ? ' on' : ''}" data-act="${act}" data-id="${esc(p.id)}">${esc(playerLabel(p))}</button>`).join('') || '<span class="src">niemand</span>';
    root.innerHTML = `<h2>Wissel</h2><div class="row"><button type="button" class="${team === 0 ? 'on' : ''}" data-act="sheet-team" data-team="0">${esc(teamName(S, 0))}</button><button type="button" class="${team === 1 ? 'on' : ''}" data-act="sheet-team" data-team="1">${esc(teamName(S, 1))}</button></div><p class="src">Wissels ${esc(lim)}</p><p>Uit het veld</p><div class="chips">${chips(players.filter((p) => p.on), 'pick-out', sheet.outId)}</div><p>Ervoor in de plaats</p><div class="chips">${chips(players.filter((p) => !p.on), 'pick-in', sheet.inId)}</div><div class="row"><input id="sheetOut" placeholder="UIT nr of naam" value="${esc(sheet.outText || '')}" aria-label="Uitgaande speler"><input id="sheetIn" placeholder="IN nr of naam" value="${esc(sheet.inText || '')}" aria-label="Inkomende speler"></div><button type="button" class="o xl" data-act="confirm-sub">Registreer wissel</button><button type="button" data-act="close-sheet">Sluiten</button>`;
  } else if (sheet.kind === 'card') {
    const players = S.players[team];
    const chips = players.map((p) => `<button type="button" class="chip${sheet.playerId === p.id ? ' on' : ''}" data-act="pick-card" data-id="${esc(p.id)}">${esc(playerLabel(p))}</button>`).join('');
    root.innerHTML = `<h2>Kaart</h2><div class="row"><button type="button" class="${team === 0 ? 'on' : ''}" data-act="sheet-team" data-team="0">${esc(teamName(S, 0))}</button><button type="button" class="${team === 1 ? 'on' : ''}" data-act="sheet-team" data-team="1">${esc(teamName(S, 1))}</button></div><label>Wie<select id="sheetWho"><option value="speler"${sheet.who === 'speler' ? ' selected' : ''}>Speler</option><option value="coach"${sheet.who === 'coach' ? ' selected' : ''}>Coach of assistent</option><option value="staf"${sheet.who === 'staf' ? ' selected' : ''}>Overig staflid</option></select></label><div class="chips">${chips}</div><input id="sheetName" placeholder="nr of naam" value="${esc(sheet.name || '')}" aria-label="Naam of nummer"><div class="row"><button type="button" class="y" data-act="confirm-card" data-color="geel">Geel</button><button type="button" class="r" data-act="confirm-card" data-color="rood">Rood</button></div><button type="button" data-act="close-sheet">Sluiten</button>`;
  }
  $('sheet').hidden = false;
  setInert(true);
  const focus = root.querySelector('button, input, select');
  if (focus) focus.focus();
}

function closeSheet() {
  if ($('sheet').hidden) return;
  sheet = null;
  $('sheet').hidden = true;
  if ($('dlg').hidden) setInert(false);
}

async function confirmSub() {
  if (!sheet || sheet.kind !== 'sub') return;
  captureSheet();
  const st = sheet;
  const team = st.team;
  let inLabel = st.inText?.trim() || '';
  let outLabel = st.outText?.trim() || '';
  let inId = st.inId;
  let outId = st.outId;
  if (outId) outLabel = playerLabel(findPlayer(S, outId));
  if (inId) inLabel = playerLabel(findPlayer(S, inId));
  if (!inId && inLabel) inId = matchPlayer(team, inLabel);
  if (!outId && outLabel) outId = matchPlayer(team, outLabel);
  closeSheet();
  const a = assessSub(S, Date.now(), team);
  if (a.over) {
    const ok = await ask(`Het maximum van ${a.max} wissels is bereikt. Alleen een geblesseerde of weggestuurde speler, met toestemming van de scheidsrechter. Doorgaan?`);
    if (!ok) return;
  }
  if (a.blocked) {
    const ok = await ask('Coach of staf heeft een tijdstraf. Wisselen is dan niet toegestaan. Toch vastleggen?');
    if (!ok) return;
  }
  applySub(S, Date.now(), { team, inLabel: inLabel || '?', outLabel: outLabel || '?', inId, outId });
  save();
  render();
}

function matchPlayer(team, text) {
  const t = text.trim().toLowerCase();
  const list = S.players[team] || [];
  const hit = list.find((p) => playerLabel(p).toLowerCase() === t)
    || list.find((p) => String(p.nr) === text.trim())
    || list.find((p) => p.name.toLowerCase() === t);
  return hit ? hit.id : null;
}

async function confirmCard(color) {
  if (!sheet || sheet.kind !== 'card') return;
  captureSheet();
  const st = sheet;
  const team = st.team;
  const who = st.who || 'speler';
  let name = st.name?.trim() || '';
  if (st.playerId) name = playerLabel(findPlayer(S, st.playerId));
  if (!name) name = '?';
  closeSheet();
  if (assessCard(S, { team, name, color }).second) {
    const ok = await ask(`Tweede geel voor ${name} wordt gevolgd door rood. Deze kaart vastleggen?`);
    if (!ok) return;
  }
  applyCard(S, Date.now(), { team, who, name, color });
  save();
  render();
}

function ask(msg, okText = 'OK', cancelText = 'Annuleer') {
  if (!$('dlg').hidden) return Promise.resolve(false);
  return new Promise((resolve) => {
    $('dlgMsg').textContent = msg;
    $('dlgOk').textContent = okText;
    $('dlgNo').hidden = false;
    $('dlgNo').textContent = cancelText;
    $('dlg').hidden = false;
    setInert(true);
    $('dlgOk').focus();
    dlgRes = resolve;
  });
}

function note(msg) {
  if (!$('dlg').hidden) return Promise.resolve();
  return new Promise((resolve) => {
    $('dlgMsg').textContent = msg;
    $('dlgOk').textContent = 'OK';
    $('dlgNo').hidden = true;
    $('dlg').hidden = false;
    setInert(true);
    $('dlgOk').focus();
    dlgRes = () => resolve();
  });
}

function closeDlg(value) {
  $('dlg').hidden = true;
  if ($('sheet').hidden) setInert(false);
  const resolve = dlgRes;
  dlgRes = null;
  if (resolve) resolve(!!value);
}

function setInert(on) {
  for (const id of ['topbar', 'main', 'quickbar', 'tabs']) {
    const el = $(id);
    if (el) el.inert = on;
  }
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function dismissInstall() {
  meta.installDismissed = true;
  $('install').hidden = true;
  save();
}

async function onPersist() {
  const info = await persistFn();
  meta.persist = !!info.persisted;
  renderStore(info);
  save();
}

let wakeLock;
async function wake() {
  const el = $('wk');
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    el.textContent = 'Scherm blijft aan.';
  } catch (err) {
    el.textContent = 'Wakker houden lukt niet in deze browser. Op iPhone werkt het vanaf iOS 16.4, in Safari of als beginscherm-app.';
  }
}

document.addEventListener('visibilitychange', () => {
  if (wakeLock && document.visibilityState === 'visible') wake();
});

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = audioCtx || new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (err) {
    /* geen audio */
  }
  if (navigator.vibrate) navigator.vibrate(180);
}
