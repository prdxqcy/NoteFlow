import { useCallback, useEffect, useState } from 'react';

const KEY = 'cove_reminders';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function persist(reminders) {
  localStorage.setItem(KEY, JSON.stringify(reminders));
}

function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.8);
      osc.start(ctx.currentTime + i * 0.2);
      osc.stop(ctx.currentTime + i * 0.2 + 0.8);
    });
  } catch { /* AudioContext blocked */ }
}

export function useReminders() {
  const [reminders, setReminders] = useState(load);

  const update = useCallback((next) => {
    persist(next);
    setReminders([...next]);
  }, []);

  const add = useCallback((time, note) => {
    const [h, m] = time.split(':');
    const dt = new Date();
    dt.setHours(+h, +m, 0, 0);
    update([...load(), { id: crypto.randomUUID(), note: note.trim() || `Reminder at ${time}`, time: dt.toISOString(), fired: false }]);
  }, [update]);

  const remove = useCallback((id) => {
    update(load().filter((r) => r.id !== id));
  }, [update]);

  const clearFired = useCallback(() => {
    update(load().filter((r) => !r.fired));
  }, [update]);

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const check = () => {
      const now = Date.now();
      const current = load();
      let changed = false;
      for (const r of current) {
        if (!r.fired && new Date(r.time).getTime() <= now) {
          r.fired = true;
          changed = true;
          playChime();
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            // eslint-disable-next-line no-new
            new Notification('Cove Reminder', { body: r.note, icon: '/icons/icon-192.png', tag: r.id });
          }
        }
      }
      if (changed) update(current);
    };

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [update]);

  return { reminders, add, remove, clearFired };
}
