import { describe, expect, it } from 'vitest';
import {
  addGoal,
  addPlayer,
  applyCard,
  applySub,
  applyTimeout,
  assessCard,
  assessSub,
  assessTimeout,
  buildReport,
  clkRemaining,
  defaultState,
  elapsedPeriod,
  exportBundle,
  fmtDown,
  fmtUp,
  freshMatch,
  importBundle,
  limits,
  makeArchiveItem,
  migrate,
  minuteMark,
  nextPeriod,
  penRemaining,
  periodName,
  played,
  playerTime,
  resetShot,
  restoreShot,
  setElapsed,
  setHalf,
  shotRemaining,
  startClock,
  startShot,
  stopClock,
  syncTo,
} from '../js/clock.js';
import { chooseCurrent } from '../js/storage.js';

const T0 = Date.UTC(2026, 9, 31, 12, 0, 0);

describe('wedstrijdklok', () => {
  it('loopt op timestamps en staat stil na stop', () => {
    const s = defaultState();
    expect(startClock(s, T0).ok).toBe(true);
    expect(clkRemaining(s, T0 + 2500)).toBe(25 * 60 * 1000 - 2500);
    stopClock(s, T0 + 2500);
    expect(clkRemaining(s, T0 + 99999)).toBe(25 * 60 * 1000 - 2500);
    expect(s.run).toBe(false);
  });

  it('start niet als de tijd op nul staat', () => {
    const s = defaultState();
    s.clk = 0;
    expect(startClock(s, T0).ok).toBe(false);
    expect(s.run).toBe(false);
  });

  it('eindigt de periode op de timestamp waarop de klok nul was', () => {
    const s = defaultState();
    startClock(s, T0);
    s.clk = 1000;
    s.runAt = T0;
    const events = syncTo(s, T0 + 1500);
    expect(s.run).toBe(false);
    expect(s.clk).toBe(0);
    expect(events.some((e) => e.type === 'period')).toBe(true);
  });

  it('rekent 2e helft minuut 5 bij 30 minuten helften als 35:00', () => {
    const s = defaultState();
    setHalf(s, 30);
    setElapsed(s, T0, 30 * 60 * 1000);
    expect(fmtUp(played(s, T0))).toBe('30:00');
    expect(nextPeriod(s, T0).ok).toBe(true);
    expect(periodName(s)).toBe('Rust');
    expect(played(s, T0)).toBe(30 * 60 * 1000);
    expect(nextPeriod(s, T0).ok).toBe(true);
    expect(periodName(s)).toBe('2e helft');
    setElapsed(s, T0, 5 * 60 * 1000);
    expect(fmtUp(played(s, T0))).toBe('35:00');
    expect(fmtUp(elapsedPeriod(s, T0))).toBe('05:00');
    expect(fmtDown(clkRemaining(s, T0))).toBe('25:00');
    expect(minuteMark(s, T0)).toBe(36);
  });

  it('zet een wissel in het log op de cumulatieve minuut', () => {
    const s = defaultState();
    setHalf(s, 30);
    setElapsed(s, T0, 30 * 60 * 1000);
    nextPeriod(s, T0);
    nextPeriod(s, T0);
    setElapsed(s, T0, 5 * 60 * 1000);
    applySub(s, T0, { team: 0, inLabel: '7 A', outLabel: '4 B' });
    expect(s.log[0].startsWith("36' (35:00)")).toBe(true);
    expect(s.log[0]).toContain('Wissel');
  });

  it('maakt de rust één minuut korter dan de ingestelde rust', () => {
    const s = defaultState();
    s.set.rust = 10;
    nextPeriod(s, T0);
    expect(periodName(s)).toBe('Rust');
    expect(fmtDown(s.clk)).toBe('09:00');
  });
});

describe('schotklok', () => {
  it('start de wedstrijdklok mee en pauzeert samen met die klok', () => {
    const s = defaultState();
    startShot(s, T0);
    expect(s.run).toBe(true);
    expect(s.shotRun).toBe(true);
    expect(clkRemaining(s, T0 + 2000)).toBe(25 * 60 * 1000 - 2000);
    expect(shotRemaining(s, T0 + 2000)).toBe(25000 - 2000);
    stopClock(s, T0 + 2000);
    expect(s.shotRun).toBe(false);
    expect(s.shotResume).toBe(true);
    expect(shotRemaining(s, T0 + 9000)).toBe(23000);
    startClock(s, T0 + 9000);
    expect(s.shotRun).toBe(true);
    expect(s.shotResume).toBe(false);
    expect(shotRemaining(s, T0 + 10000)).toBe(22000);
  });

  it('reset blijft op 25 staan terwijl de wedstrijdklok doorloopt', () => {
    const s = defaultState();
    startClock(s, T0);
    startShot(s, T0);
    resetShot(s, T0 + 3000, { start: false, action: 'reset' });
    expect(s.shot).toBe(25000);
    expect(s.shotRun).toBe(false);
    expect(s.shotResume).toBe(false);
    expect(s.run).toBe(true);
    expect(clkRemaining(s, T0 + 5000)).toBe(25 * 60 * 1000 - 5000);
    expect(shotRemaining(s, T0 + 5000)).toBe(25000);
    stopClock(s, T0 + 5000);
    startClock(s, T0 + 8000);
    expect(s.run).toBe(true);
    expect(s.shotRun).toBe(false);
    expect(shotRemaining(s, T0 + 9000)).toBe(25000);
  });

  it('SCHOT start beide klokken vanaf 25', () => {
    const s = defaultState();
    const { startedMatch } = resetShot(s, T0, { start: true, action: 'reset+start' });
    expect(startedMatch).toBe(true);
    expect(s.run).toBe(true);
    expect(s.shotRun).toBe(true);
    expect(shotRemaining(s, T0 + 1000)).toBe(24000);
  });

  it('start een verlopen schotklok niet vanzelf mee', () => {
    const s = defaultState();
    startClock(s, T0);
    startShot(s, T0);
    syncTo(s, T0 + 25000);
    expect(s.shot).toBe(0);
    expect(s.shotRun).toBe(false);
    expect(s.shotResume).toBe(false);
    stopClock(s, T0 + 26000);
    startClock(s, T0 + 27000);
    expect(s.run).toBe(true);
    expect(s.shotRun).toBe(false);
    expect(s.shot).toBe(0);
  });

  it('onthoudt de tijd vóór een reset, maximaal vijf, en herstelt die', () => {
    const s = defaultState();
    for (let i = 1; i <= 6; i += 1) {
      s.shot = i * 1000;
      s.shotRun = false;
      resetShot(s, T0, { start: false, action: 'reset' });
    }
    expect(s.shotHist).toHaveLength(5);
    expect(s.shotHist[0].beforeMs).toBe(6000);
    expect(s.shotHist[4].beforeMs).toBe(2000);
    expect(s.shotHist[0].minute).toBe(1);
    expect(s.shot).toBe(25000);
    restoreShot(s, T0, 0);
    expect(s.shot).toBe(6000);
    expect(s.shotRun).toBe(false);
    expect(s.shotHist[0].action).toBe('herstel');
    expect(s.shotHist[0].beforeMs).toBe(25000);
    expect(s.shotHist.length).toBeLessThanOrEqual(5);
  });

  it('zet een lopende schotklok na herstel weer aan', () => {
    const s = defaultState();
    startShot(s, T0);
    const before = shotRemaining(s, T0 + 4000);
    resetShot(s, T0 + 4000, { start: true, action: 'reset+start' });
    expect(s.shotHist[0].beforeMs).toBe(before);
    expect(s.shotHist[0].wasRunning).toBe(true);
    expect(s.shotRun).toBe(true);
    restoreShot(s, T0 + 4000, 0);
    expect(s.shot).toBe(before);
    expect(s.shotRun).toBe(true);
  });
});

describe('straf en wissel', () => {
  it('laat een tijdstraf alleen meelopen met de wedstrijdklok', () => {
    const s = defaultState();
    applyCard(s, T0, { team: 0, who: 'speler', name: '4 A', color: 'geel' });
    expect(s.pens).toHaveLength(1);
    expect(penRemaining(s.pens[0], s, T0 + 20000)).toBe(240000);
    startClock(s, T0 + 20000);
    expect(penRemaining(s.pens[0], s, T0 + 25000)).toBe(235000);
    stopClock(s, T0 + 25000);
    expect(penRemaining(s.pens[0], s, T0 + 80000)).toBe(235000);
  });

  it('meldt een afgelopen straf één keer', () => {
    const s = defaultState();
    applyCard(s, T0, { team: 1, who: 'coach', name: 'Coach', color: 'geel' });
    startClock(s, T0);
    s.pens[0].left = 3000;
    s.pens[0].syncAt = T0;
    const events = syncTo(s, T0 + 3000);
    expect(events.filter((e) => e.type === 'pen')).toHaveLength(1);
    expect(s.pens[0].left).toBe(0);
    expect(syncTo(s, T0 + 4000).some((e) => e.type === 'pen')).toBe(false);
  });

  it('geeft bij breedte geen tijdstraf en geen time-out', () => {
    const s = defaultState();
    s.set.type = 'B';
    applyCard(s, T0, { team: 0, who: 'speler', name: '4 A', color: 'geel' });
    expect(s.pens).toHaveLength(0);
    expect(assessTimeout(s, T0, 0)).toMatchObject({ ok: false, reason: 'none' });
    expect(limits(s).sub).toBe(Infinity);
  });

  it('blokkeert time-out en wissel tijdens een tijdstraf van de staf', () => {
    const s = defaultState();
    applyCard(s, T0, { team: 0, who: 'coach', name: 'Coach', color: 'geel' });
    startClock(s, T0);
    expect(assessTimeout(s, T0 + 1000, 0).blocked).toBe(true);
    expect(assessSub(s, T0 + 1000, 0).blocked).toBe(true);
    expect(assessTimeout(s, T0 + 1000, 1).blocked).toBe(false);
  });

  it('herkent een tweede geel en het wisselmaximum', () => {
    const s = defaultState();
    applyCard(s, T0, { team: 0, who: 'speler', name: '4 A', color: 'geel' });
    expect(assessCard(s, { team: 0, name: '4 A', color: 'geel' }).second).toBe(true);
    s.subs[0] = 8;
    expect(assessSub(s, T0, 0).over).toBe(true);
    s.set.type = 'B';
    expect(assessSub(s, T0, 0).over).toBe(false);
  });

  it('schrijft speeltijd bij een wissel en telt de wissel', () => {
    const s = defaultState();
    const a = addPlayer(s, 0, '4', 'A');
    const b = addPlayer(s, 0, '7', 'B');
    setPlayerOnForTest(s, a.id, true);
    startClock(s, T0);
    applySub(s, T0 + 5000, { team: 0, inId: b.id, outId: a.id, inLabel: '7 B', outLabel: '4 A' });
    expect(playerTime(a, s, T0 + 5000)).toBe(5000);
    expect(a.on).toBe(false);
    expect(b.on).toBe(true);
    expect(playerTime(b, s, T0 + 8000)).toBe(3000);
    expect(s.subs[0]).toBe(1);
    expect(s.log[0]).toContain("1'");
  });

  it('stopt de klok bij een doelpunt en bewaart de schotkloktijd', () => {
    const s = defaultState();
    startClock(s, T0);
    startShot(s, T0);
    addGoal(s, T0 + 2000, 0, 1);
    expect(s.run).toBe(false);
    expect(s.score).toEqual([1, 0]);
    expect(s.shotHist[0].action).toBe('doelpunt');
    expect(s.shotHist[0].beforeMs).toBe(23000);
    expect(s.shot).toBe(25000);
    expect(s.shotRun).toBe(false);
  });

  it('stopt de klok bij een time-out en telt hem', () => {
    const s = defaultState();
    startClock(s, T0);
    applyTimeout(s, T0 + 1000, 1);
    expect(s.run).toBe(false);
    expect(s.to).toEqual([0, 1]);
    expect(s.toEnd - (T0 + 1000)).toBe(60000);
    expect(s.log[0]).toContain('Time-out');
  });
});

describe('migratie en archief', () => {
  it('zet een ongebruikte oude installatie op Thuis en Uit', () => {
    const s = migrate({
      set: { type: 'A', tA: 'Oud thuis', tB: 'Oud uit', half: 20, rust: 8 },
      score: [0, 0],
      log: [],
      clk: 20 * 60 * 1000,
    });
    expect(s.set.tA).toBe('Thuis');
    expect(s.set.tB).toBe('Uit');
    expect(s.set.type).toBe('A');
    expect(s.set.half).toBe(20);
    expect(s.schema).toBe(2);
  });

  it('bewaart namen als de wedstrijd al bezig was', () => {
    const s = migrate({
      set: { tA: 'Noord', tB: 'Zuid' },
      score: [2, 1],
      log: ['iets'],
    });
    expect(s.set.tA).toBe('Noord');
    expect(s.set.tB).toBe('Zuid');
  });

  it('kiest de nieuwste stand van de twee opslagplekken', () => {
    const older = defaultState();
    older.savedAt = 10;
    older.set.tA = 'Oud';
    const newer = defaultState();
    newer.savedAt = 20;
    newer.set.tA = 'Nieuw';
    expect(chooseCurrent(older, newer).set.tA).toBe('Nieuw');
    expect(chooseCurrent(newer, older).set.tA).toBe('Nieuw');
  });

  it('exporteert en importeert een bundel', () => {
    const s = defaultState();
    s.set.tA = 'Noord';
    addGoal(s, T0, 0, 1);
    const item = makeArchiveItem(s, T0);
    const raw = exportBundle(s, [item], T0);
    const back = importBundle(JSON.parse(JSON.stringify(raw)));
    expect(back.current.score).toEqual([1, 0]);
    expect(back.current.set.tA).toBe('Noord');
    expect(back.archive).toHaveLength(1);
    expect(() => importBundle({ app: 'anders' })).toThrow();
  });

  it('houdt spelers bij een nieuwe wedstrijd en wist de stand', () => {
    const s = defaultState();
    s.set.tA = 'Noord';
    const p = addPlayer(s, 0, '8', 'A');
    p.on = true;
    p.played = 5000;
    addGoal(s, T0, 0, 1);
    const n = freshMatch(s);
    expect(n.set.tA).toBe('Noord');
    expect(n.players[0][0].name).toBe('A');
    expect(n.players[0][0].on).toBe(false);
    expect(n.players[0][0].played).toBe(0);
    expect(n.score).toEqual([0, 0]);
    expect(n.log).toEqual([]);
  });

  it('zet het rapport op de cumulatieve tijd', () => {
    const s = defaultState();
    setElapsed(s, T0, 90 * 1000);
    applyTimeout(s, T0, 0);
    const text = buildReport(s, T0);
    expect(text).toContain("2' (01:30)");
    expect(text).toContain('Totaal gespeeld 01:30');
  });
});

function setPlayerOnForTest(s, id, on) {
  const p = s.players.flat().find((x) => x.id === id);
  p.on = on;
}
