import { getCardState, getDisplayName } from "../lib/hvac.js";

export function UnitCard({ unit, timers = [], onOpen }) {
  const state = getCardState(unit);
  const nextTimer = getNextTimer(timers);
  const statusText = nextTimer ? formatTimerStatus(nextTimer) : unit.on === 1 ? `Set ${unit.tempSet}° · ${unit.modeLabel} · ${unit.fanLabel}` : "Off";

  return (
    <button className={cardClassName(state)} type="button" onClick={onOpen}>
      <span className="absolute inset-0 bg-gradient-to-br from-white/28 via-white/8 to-white/4 dark:bg-none dark:bg-white/5" aria-hidden="true" />
      <span className="relative grid gap-3">
        <span className="flex items-start justify-between gap-3">
          <span className="block min-w-0 max-w-36 overflow-wrap-anywhere text-left text-xl font-bold leading-tight text-slate-950 dark:text-white">
            {getDisplayName(unit)}
          </span>
          <StatusDot state={state} />
        </span>
        <span className="text-left text-5xl font-bold leading-none text-slate-950 dark:text-white">{unit.tempIn}°</span>
        <span className="truncate text-left text-sm font-semibold text-slate-600/75 dark:text-slate-200/75">
          {statusText}
        </span>
      </span>
    </button>
  );
}

function getNextTimer(timers) {
  const now = Date.now();
  return timers
    .filter((timer) => new Date(timer.runAt).getTime() > now)
    .sort((left, right) => new Date(left.runAt).getTime() - new Date(right.runAt).getTime())[0];
}

function formatTimerStatus(timer) {
  const actionLabel = timer.action === "on" ? "Start at" : "Stop at";
  const date = new Date(timer.runAt);
  if (Number.isNaN(date.getTime())) return actionLabel;
  return `${actionLabel} ${formatTime(date)}`;
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function cardClassName(state) {
  const base =
    "relative grid min-h-36 overflow-hidden rounded-3xl p-4 text-left shadow-lg shadow-slate-900/5 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/16 dark:border dark:shadow-black/24 dark:hover:bg-slate-950/48 sm:min-h-40";
  if (state === "running") return `${base} bg-white/10 dark:border-white/10 dark:bg-slate-950/38`;
  if (state === "warning") return `${base} bg-white/10 dark:border-white/10 dark:bg-slate-950/38`;
  return `${base} bg-white/8 dark:border-white/9 dark:bg-slate-950/32`;
}

function StatusDot({ state }) {
  const dotClassName = statusDotClassName(state);

  return (
    <span className="relative mt-1 grid size-2.5 shrink-0 place-items-center" aria-hidden="true">
      {state === "running" ? <span className="absolute size-2.5 animate-ping rounded-full bg-emerald-400/45" /> : null}
      <span className={dotClassName} />
    </span>
  );
}

function statusDotClassName(state) {
  const base = "relative size-2.5 rounded-full";
  if (state === "running") return `${base} bg-emerald-400`;
  if (state === "warning") return `${base} bg-white/68 dark:bg-white/62`;
  return `${base} bg-slate-900/24 dark:bg-white/30`;
}
