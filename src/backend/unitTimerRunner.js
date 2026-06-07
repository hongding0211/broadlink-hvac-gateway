export class UnitTimerRunner {
  constructor({ store, client, intervalMs = 15_000, now = () => new Date() }) {
    this.store = store;
    this.client = client;
    this.intervalMs = intervalMs;
    this.now = now;
    this.timer = null;
    this.running = false;
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

  async runDueTimers() {
    if (this.running) return;

    this.running = true;
    try {
      const nowTime = this.now().getTime();
      const timers = await this.store.list();

      for (const timer of timers) {
        if (new Date(timer.runAt).getTime() > nowTime) continue;

        try {
          await this.client.updateUnit(timer.unitIdx, { on: timer.action === "on" ? 1 : 0 });
          await this.store.delete(timer.unitIdx, timer.action);
        } catch (error) {
          console.error(`Unit timer "${timer.id}" failed: ${error.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  enqueueRun() {
    this.runDueTimers().catch((error) => {
      console.error(`Unit timer runner failed: ${error.message}`);
    });
  }
}
