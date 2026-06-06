import { getCardState, getDisplayName, getStateName } from "../lib/hvac.js";

export function UnitCard({ unit, onOpen }) {
  const state = getCardState(unit);
  const stateName = getStateName(unit);

  return (
    <button className={cardClassName(state)} type="button" onClick={onOpen}>
      <span className="absolute inset-0 bg-gradient-to-br from-white/55 to-white/10" aria-hidden="true" />
      <span className="relative flex items-start justify-between gap-3">
        <span>
          <span className="block max-w-36 overflow-wrap-anywhere text-left text-xl font-bold leading-tight text-slate-950">
            {getDisplayName(unit)}
          </span>
          <span className="mt-1.5 block text-left text-sm font-semibold text-slate-600/75">{stateName}</span>
        </span>
        <span className={dotClassName(state)} aria-hidden="true" />
      </span>
      <span className="relative mt-auto grid gap-1">
        <span className="text-5xl font-bold leading-none text-slate-950">{unit.tempIn}°</span>
        <span className="text-sm font-medium text-slate-600/75">Room temperature</span>
      </span>
      <span className="relative truncate text-left text-sm text-slate-600/75">
        {unit.on === 1 ? `Set ${unit.tempSet}° · ${unit.modeLabel} · ${unit.fanLabel}` : "Tap to view"}
      </span>
    </button>
  );
}

function cardClassName(state) {
  const base =
    "relative grid min-h-44 overflow-hidden rounded-3xl border border-white/70 p-4 text-left shadow-xl shadow-slate-900/10 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/70 sm:min-h-48";
  if (state === "running") return `${base} bg-teal-50/75`;
  if (state === "warning") return `${base} bg-amber-50/80`;
  return `${base} bg-white/55`;
}

function dotClassName(state) {
  const base = "mt-1 size-3.5 rounded-full shadow-[0_0_0_5px]";
  if (state === "running") return `${base} bg-teal-700 shadow-teal-700/15`;
  if (state === "warning") return `${base} bg-amber-700 shadow-amber-700/15`;
  return `${base} bg-slate-900/35 shadow-slate-900/10`;
}
