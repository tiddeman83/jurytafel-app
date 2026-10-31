import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const port = 8788;
const outDir = '/opt/cursor/artifacts/screenshots';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 300));
await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const sizes = [
  [375, 812],
  [390, 844],
  [430, 932],
];

try {
  for (const [width, height] of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width, height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const client = await page.createCDPSession();
    await client.send('Emulation.setEmulatedMedia', {
      media: '',
      features: [{ name: 'display-mode', value: 'standalone' }],
    });
    await client.send('Emulation.setSafeAreaInsetsOverride', {
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('#clk');
    if (await page.$('#install:not([hidden])')) await page.click('#installDismiss');
    const top = `${outDir}/wedstrijd-${width}x${height}.png`;
    await page.screenshot({ path: top });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const bottom = `${outDir}/schotklok-${width}x${height}.png`;
    await page.screenshot({ path: bottom });
    const check = await page.evaluate(() => {
      const r = (sel) => document.querySelector(sel).getBoundingClientRect();
      const shot = r('.shot');
      const quick = r('.quick');
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        mode: document.getElementById('modeJury').innerText,
        standalone: matchMedia('(display-mode: standalone)').matches,
        padTop: getComputedStyle(document.body).paddingTop,
        juryBg: getComputedStyle(document.querySelector('.seg button.on')).backgroundColor,
        shotGap: Math.round(quick.top - shot.bottom),
        sameRow: Math.abs(r('#nameA').top - r('#nameB').top) < 3,
        plusW: Math.round(r('[data-team="0"][data-d="1"]').width),
        minusW: Math.round(r('[data-team="0"][data-d="-1"]').width),
      };
    });
    console.log(width, check, top);
    if (check.overflow > 1 || !check.sameRow || check.shotGap < 8 || check.plusW !== check.minusW) {
      throw new Error(`layout ${width}: ${JSON.stringify(check)}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
