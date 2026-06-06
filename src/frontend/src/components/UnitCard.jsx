import { getCardState, getDisplayName, getStateName } from "../lib/hvac.js";

export function UnitCard({ unit, onOpen }) {
  const state = getCardState(unit);
  const stateName = getStateName(unit);

  return (
    <button className={cardClassName(state)} type="button" onClick={onOpen}>
      <span className="absolute inset-0 bg-gradient-to-br from-white/55 to-white/10 dark:from-white/14 dark:to-white/5" aria-hidden="true" />
      <span className="relative flex items-start justify-between gap-3">
        <span>
          <span className="block max-w-36 overflow-wrap-anywhere text-left text-xl font-bold leading-tight text-slate-950 dark:text-white">
            {getDisplayName(unit)}
          </span>
          <span className="mt-1.5 block text-left text-sm font-semibold text-slate-600/75 dark:text-slate-200/75">{stateName}</span>
        </span>
        <span className={dotClassName(state)} aria-hidden="true" />
      </span>
      <span className="relative mt-auto grid gap-1">
        <span className="text-5xl font-bold leading-none text-slate-950 dark:text-white">{unit.tempIn}°</span>
        <span className="text-sm font-medium text-slate-600/75 dark:text-slate-200/75">Room temperature</span>
      </span>
      <span className="relative truncate text-left text-sm text-slate-600/75 dark:text-slate-200/75">
        {unit.on === 1 ? `Set ${unit.tempSet}° · ${unit.modeLabel} · ${unit.fanLabel}` : "Tap to view"}
      </span>
    </button>
  );
}

function cardClassName(state) {
  const base =
    "relative grid min-h-44 overflow-hidden rounded-3xl border border-white/70 p-4 text-left shadow-xl shadow-slate-900/10 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/70 dark:border-white/15 dark:shadow-black/25 sm:min-h-48";
  if (state === "running") return `${base} bg-teal-50/75 dark:bg-teal-950/42 dark:hover:bg-teal-900/48`;
  if (state === "warning") return `${base} bg-amber-50/80 dark:bg-amber-950/42 dark:hover:bg-amber-900/48`;
  return `${base} bg-white/55 dark:bg-slate-950/35 dark:hover:bg-slate-900/52`;
}

function dotClassName(state) {
  const base = "mt-1 size-3.5 rounded-full shadow-[0_0_0_5px]";
  if (state === "running") return `${base} bg-teal-700 shadow-teal-700/15 dark:bg-teal-300 dark:shadow-teal-300/20`;
  if (state === "warning") return `${base} bg-amber-700 shadow-amber-700/15 dark:bg-amber-300 dark:shadow-amber-300/20`;
  return `${base} bg-slate-900/35 shadow-slate-900/10 dark:bg-slate-200/50 dark:shadow-white/10`;
}
