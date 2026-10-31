import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const port = 8765;
const url = `http://127.0.0.1:${port}/`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'ignore',
});

const errors = [];
let browser;

function fail(msg) {
  throw new Error(msg);
}

async function waitUp() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (err) {
      /* server nog niet klaar */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  fail('server start niet');
}

async function tap(page, selector) {
  await page.$eval(selector, (el) => el.scrollIntoView({ block: 'center' }));
  const covered = await page.$eval(selector, (el) => {
    const rect = el.getBoundingClientRect();
    const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return !(top === el || el.contains(top));
  });
  if (covered) await page.$eval(selector, (el) => el.click());
  else await page.click(selector);
}

async function setField(page, selector, value) {
  await page.$eval(selector, (el, v) => {
    el.focus();
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

try {
  await waitUp();
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('Failed to load resource') || text.includes('favicon')) return;
    errors.push(`console: ${text}`);
  });
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const client = await page.createCDPSession();
  await client.send('Emulation.setSafeAreaInsetsOverride', {
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#clk');

  const body = await page.evaluate(() => document.body.innerText);
  const oldName = String.fromCharCode(86, 105, 107, 105, 110, 103);
  const oldMark = String.fromCharCode(74, 50);
  if (body.includes(oldName) || body.includes(oldMark)) fail('oude ploegnaam zichtbaar');
  const nameA = await page.$eval('#nameA', (el) => el.value);
  const nameB = await page.$eval('#nameB', (el) => el.value);
  if (nameA !== 'Thuis' || nameB !== 'Uit') fail(`standaardnamen ${nameA} ${nameB}`);

  if (await page.$('#install:not([hidden])')) await page.click('#installDismiss');

  const layout = await page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height };
    };
    const fits = (r) => r.l >= -1 && r.r <= window.innerWidth + 1;
    window.scrollTo(0, 0);
    const shot = box('.shot');
    const quick = box('.quick');
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      jury: box('#modeJury'),
      coach: box('#modeCoach'),
      nieuw: box('[data-act="new-match"]'),
      nameA: box('#nameA'),
      nameB: box('#nameB'),
      minusA: box('[data-team="0"][data-d="-1"]'),
      plusA: box('[data-team="0"][data-d="1"]'),
      minusB: box('[data-team="1"][data-d="-1"]'),
      plusB: box('[data-team="1"][data-d="1"]'),
      cap: getComputedStyle(document.getElementById('clkCap')).textAlign,
      juryBg: getComputedStyle(document.querySelector('.seg button.on')).backgroundColor,
      juryClip: document.getElementById('modeJury').scrollWidth - document.getElementById('modeJury').clientWidth,
      coachClip: document.getElementById('modeCoach').scrollWidth - document.getElementById('modeCoach').clientWidth,
      shotBottom: shot.b,
      quickTop: quick.t,
      fitsJury: fits(box('#modeJury')),
      fitsCoach: fits(box('#modeCoach')),
    };
  });
  if (layout.overflow > 1) fail(`horizontale overflow ${layout.overflow}px`);
  if (!layout.fitsJury || !layout.fitsCoach || layout.jury.w < 70 || layout.coach.w < 60) fail(`modus past niet ${JSON.stringify(layout.jury)} ${JSON.stringify(layout.coach)}`);
  if (layout.juryClip > 2 || layout.coachClip > 2) fail('modustekst wordt afgekapt');
  if (layout.juryBg === 'rgba(0, 0, 0, 0)') fail('geselecteerde modus heeft geen achtergrond');
  if (Math.abs(layout.nameA.t - layout.nameB.t) > 2) fail('ploegnamen staan niet op één rij');
  for (const pair of [['minusA', 'plusA'], ['minusB', 'plusB'], ['minusA', 'minusB'], ['plusA', 'plusB']]) {
    if (Math.abs(layout[pair[0]].w - layout[pair[1]].w) > 2) fail(`knoppen ongelijk ${pair}: ${layout[pair[0]].w} ${layout[pair[1]].w}`);
  }
  if (layout.cap !== 'center') fail('label resterend staat niet gecentreerd');
  const shotGap = layout.quickTop - layout.shotBottom;
  if (shotGap < -1) fail(`schotklok onder de balk: ${layout.shotBottom} > ${layout.quickTop}`);
  if (shotGap > 28) fail(`te veel lege ruimte onder de schotklok: ${Math.round(shotGap)}px`);
  if (layout.jury.h < 36 || layout.plusA.h < 36) fail(`tikvlak te klein ${layout.jury.h} ${layout.plusA.h}`);
  await page.evaluate(() => window.scrollTo(0, 0));

  await setField(page, '#nameA', 'Alpha');
  await setField(page, '#nameB', 'Beta');
  await page.waitForFunction(() => (localStorage.getItem('jt') || '').includes('Alpha'));

  await page.click('#clkBtn');
  await new Promise((r) => setTimeout(r, 1300));
  const running = await page.$eval('#clk', (el) => el.textContent);
  const elapsed = await page.$eval('#elap', (el) => el.textContent);
  const total = await page.$eval('#tot', (el) => el.textContent);
  if (running === '25:00') fail('klok loopt niet af');
  if (elapsed === '00:00' || total === '00:00') fail('gespeelde tijd blijft 0');
  await page.click('#clkBtn');
  const frozen = await page.$eval('#clk', (el) => el.textContent);
  await new Promise((r) => setTimeout(r, 700));
  const still = await page.$eval('#clk', (el) => el.textContent);
  if (frozen !== still) fail('klok loopt door na stop');

  await page.click('#clkBtn');
  await page.click('[data-act="goal"][data-team="0"][data-d="1"]');
  const score = await page.$eval('#sA', (el) => el.textContent);
  const stopped = await page.$eval('#clkBtn', (el) => el.textContent);
  if (score !== '1' || stopped !== 'START') fail(`doelpunt stopt de klok niet (${score}, ${stopped})`);

  await page.click('#toA');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.click('#dlgOk');
  await page.waitForFunction(() => document.getElementById('toA').textContent === 'TO 1');

  await tap(page, '[data-act="shot-start"]');
  await new Promise((r) => setTimeout(r, 1200));
  await tap(page, '[data-act="shot-reset"]');
  await tap(page, '#shotToggle');
  await page.waitForSelector('[data-act="shot-restore"]');
  const before = await page.$eval('#shotHist', (el) => el.innerText);
  if (!/\d+s/.test(before) || !before.includes('24s') && !before.includes('23s')) fail(`geen schotklokhistorie: ${before}`);
  await tap(page, '[data-act="shot-restore"]');
  const restored = Number(await page.$eval('#shot', (el) => el.textContent));
  if (restored < 20 || restored > 24) fail(`herstel zette ${restored}s`);

  await page.click('#tab-spel');
  await setField(page, '#addNr0', '7');
  await setField(page, '#addName0', 'De Boer');
  await tap(page, '[data-act="add-player"][data-team="0"]');
  await page.waitForFunction(() => document.querySelector('[data-pname]')?.value === 'De Boer');
  await page.click('[data-act="quick-sub"]');
  await page.waitForSelector('#sheetOut');
  await page.click('[data-act="close-sheet"]');

  await page.click('#tab-regels');
  await page.waitForFunction(() => document.getElementById('regels').innerText.includes('competitiehandboek'));
  const clockText = await page.$eval('#t-wed', (el) => el.innerText);
  if (clockText.includes('competitiehandboek') || clockText.includes('Bronnen')) fail('regels staan op het klokscherm');
  const toCount = await page.$$eval('#t-wed #toA, #t-wed #toB', (els) => els.length);
  if (toCount !== 2) fail('time-outknoppen ontbreken');

  await page.click('#tab-wed');
  await tap(page, '#timeAdj summary');
  await setField(page, '#half', '30');
  await page.$eval('#timeAdj', (el) => { el.open = true; });
  await setField(page, '#setElap', '30:00');
  await tap(page, '[data-act="apply-elap"]');
  await tap(page, '[data-act="next-period"]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.click('#dlgOk');
  await tap(page, '[data-act="next-period"]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.click('#dlgOk');
  await setField(page, '#setElap', '5:00');
  await tap(page, '[data-act="apply-elap"]');
  const total2 = await page.$eval('#tot', (el) => el.textContent);
  const halfPlayed = await page.$eval('#elap', (el) => el.textContent);
  const left = await page.$eval('#clk', (el) => el.textContent);
  if (total2 !== '35:00' || halfPlayed !== '05:00' || left !== '25:00') {
    fail(`cumulatief klopt niet: totaal ${total2}, helft ${halfPlayed}, rest ${left}`);
  }

  await page.click('[data-act="quick-card"]');
  await setField(page, '#sheetName', '4 A');
  await page.click('[data-act="confirm-card"][data-color="geel"]');
  await page.waitForFunction(() => document.getElementById('penLive').innerText.includes('04:00'));
  const penBefore = await page.$eval('#penLive', (el) => el.innerText);
  await new Promise((r) => setTimeout(r, 700));
  const penAfter = await page.$eval('#penLive', (el) => el.innerText);
  if (penBefore !== penAfter) fail('straf loopt terwijl de wedstrijdklok stilstaat');

  await page.click('#tab-log');
  const log = await page.$eval('#log', (el) => el.innerText);
  if (!/\d+' \(35:00\)/.test(log)) fail(`log mist cumulatieve minuut: ${log}`);

  await page.click('#tab-info');
  const info = await page.$eval('#t-info', (el) => el.innerText);
  if (!info.includes('Versie 2.0.3')) fail('versie ontbreekt');
  if (!info.includes("Zet op beginscherm") || !info.includes('App installeren')) fail('installatie-uitleg ontbreekt');
  if (!info.includes('op dit toestel')) fail('opslaguitleg ontbreekt');

  await page.select('#type', 'B');
  await page.click('#tab-wed');
  await page.waitForFunction(() => document.getElementById('toA').textContent === 'Geen TO');
  const shotVisible = await page.$eval('.shot', (el) => getComputedStyle(el).display !== 'none');
  if (!shotVisible) fail('eigen schotklok verborgen bij breedte');

  await page.click('[data-act="new-match"]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.click('#dlgNo');
  if (await page.$eval('#sA', (el) => el.textContent) !== '1') fail('annuleren wist de score');
  await page.click('[data-act="new-match"]');
  await page.waitForSelector('#dlg:not([hidden])');
  await page.click('#dlgOk');
  await page.waitForFunction(() => document.getElementById('sA').textContent === '0');
  if (await page.$eval('#nameA', (el) => el.value) !== 'Alpha') fail('ploegnaam gewist');

  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('#clk');
  if (await page.$eval('#nameA', (el) => el.value) !== 'Alpha') fail('naam niet bewaard na herladen');

  await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 8000 });
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#clk', { timeout: 8000 });
  await page.setOfflineMode(false);

  if (errors.length) fail(errors.join('\n'));
  console.log('e2e ok');
} finally {
  if (browser) await browser.close();
  server.kill();
  await once(server, 'exit').catch(() => {});
}
