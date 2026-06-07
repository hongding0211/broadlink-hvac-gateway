const dayValues = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export class AutomationRunner {
  constructor({ store, client, intervalMs = 30_000, now = () => new Date() }) {
    this.store = store;
    this.client = client;
    this.intervalMs = intervalMs;
    this.now = now;
    this.timer = null;
    this.running = false;
    this.firedKeys = new Set();
  }

  start() {
    if (this.timer) return;
    this.enqueueRun();
    this.timer = setInterval(() => {
      this.enqueueRun();
    }, this.intervalMs);
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async runDueAutomations() {
    if (this.running) return;

    this.running = true;
    try {
      const now = this.now();
      const day = dayValues[now.getDay()];
      const time = formatTime(now);
      const dateKey = formatDateKey(now);
      this.pruneFiredKeys(dateKey);

      const automations = await this.store.list();
      for (const automation of automations) {
        if (!isDue(automation, day, time)) continue;

        for (const unitIdx of getAutomationUnitIdxs(automation)) {
          const firedKey = `${dateKey}:${automation.id}:${automation.time}:${unitIdx}`;
          if (this.firedKeys.has(firedKey)) continue;

          try {
            await this.client.updateUnit(unitIdx, {
              on: 1,
              mode: automation.mode,
              fan: automation.fan,
              tempSet: automation.tempSet
            });
            this.firedKeys.add(firedKey);
          } catch (error) {
            console.error(`Automation "${automation.name}" failed for unit ${unitIdx}: ${error.message}`);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }

  enqueueRun() {
    this.runDueAutomations().catch((error) => {
      console.error(`Automation runner failed: ${error.message}`);
    });
  }

  pruneFiredKeys(dateKey) {
    for (const key of this.firedKeys) {
      if (!key.startsWith(`${dateKey}:`)) this.firedKeys.delete(key);
    }
  }
}

function isDue(automation, day, time) {
  return automation.enabled && automation.time === time && automation.days.includes(day);
}

function getAutomationUnitIdxs(automation) {
  if (Array.isArray(automation.unitIdxs) && automation.unitIdxs.length > 0) return automation.unitIdxs;
  return [automation.unitIdx];
}

function formatTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
