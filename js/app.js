import { askPersist, flushSave, loadAll, persistenceInfo, scheduleSave } from './storage.js';
import { startUi } from './ui.js';

const data = await loadAll();
let ui;

function save() {
  scheduleSave(ui.snapshot());
}

ui = startUi(data, {
  save,
  persist: async () => {
    await askPersist();
    return persistenceInfo();
  },
});

async function checkUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let reg;
  try {
    reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
  } catch (err) {
    return;
  }
  let hadController = !!navigator.serviceWorker.controller;
  const offer = () => {
    ui.showUpdate(async () => {
      if (ui.isRunning()) {
        const ok = await ui.ask('De wedstrijdklok loopt. De stand wordt bewaard. Nu verversen?');
        if (!ok) return;
      }
      await flushSave();
      location.reload();
    });
  };
  const check = () => {
    reg.update().catch(() => {});
  };
  check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  if (reg.waiting && hadController) offer();
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offer();
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    offer();
  });
}

checkUpdates();
