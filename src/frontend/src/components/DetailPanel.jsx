import { useEffect, useRef, useState } from "react";
import { Switch } from "@base-ui/react/switch";
import { Drawer } from "vaul";
import {
  ArrowLeftRight,
  ArrowUpDown,
  ChevronDown,
  CloudSun,
  Droplets,
  Edit3,
  Flame,
  Minus,
  Moon,
  Plus,
  Power,
  Snowflake,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wind
} from "lucide-react";
import { flow1Options, flow2Options, getDisplayName, getStateName } from "../lib/hvac.js";

export function DetailPanel({ unit, modes, fans, busy, onClose, onSaveAlias, onUpdate }) {
  const closeTimerRef = useRef(null);
  const [displayedUnit, setDisplayedUnit] = useState(unit);
  const [editingAlias, setEditingAlias] = useState(false);
  const [alias, setAlias] = useState("");
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    window.clearTimeout(closeTimerRef.current);

    if (unit) {
      setDisplayedUnit(unit);
      return undefined;
    }

    closeTimerRef.current = window.setTimeout(() => {
      setDisplayedUnit(null);
    }, 320);

    return () => window.clearTimeout(closeTimerRef.current);
  }, [unit]);

  useEffect(() => {
    if (!unit) return;
    setEditingAlias(false);
    setAlias(unit.alias || "");
    setShowMore(false);
  }, [unit?.idx]);

  const activeUnit = unit || displayedUnit;
  if (!activeUnit) return null;

  const panelDisabled = busy;
  const controlsDisabled = panelDisabled || activeUnit.on !== 1;
  const powerDisabled = panelDisabled || activeUnit.OnoffLock === 1;
  const modeDisabled = controlsDisabled || activeUnit.modeLock === 1;
  const tempLocked = activeUnit.tempLock === 1;
  const minTemp = tempLocked ? activeUnit.lowestVal || 16 : 16;
  const maxTemp = tempLocked ? activeUnit.highestVal || 32 : 32;
  const tempDisabled = controlsDisabled || minTemp >= maxTemp;
  const statusLine =
    activeUnit.on === 1
      ? `${getStateName(activeUnit)} · Room ${activeUnit.tempIn}° · ${activeUnit.modeLabel}`
      : `${getStateName(activeUnit)} · Room ${activeUnit.tempIn}°`;
  const theme = getModeTheme(activeUnit.mode);

  async function submitAlias(event) {
    event.preventDefault();
    await onSaveAlias(alias.trim());
    setEditingAlias(false);
  }

  function updatePower(checked) {
    if (!checked) {
      onUpdate({ on: 0 });
      return;
    }

    const hasAutoFan = fans.some((option) => option.value === 0);
    onUpdate(hasAutoFan ? { on: 1, fan: 0 } : { on: 1 });
  }

  return (
    <Drawer.Root
      open={Boolean(unit)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      direction="bottom"
      fixed
      repositionInputs
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-20 bg-white/5 opacity-0 backdrop-blur-sm transition-opacity duration-150 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 dark:bg-black/48" />
        <Drawer.Content
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-t-[34px] bg-white/34 text-slate-950 shadow-xl shadow-slate-900/10 backdrop-blur-2xl outline-none transition dark:border dark:border-white/12 dark:bg-slate-950/72 dark:text-white dark:shadow-black/45 sm:bottom-[max(16px,env(safe-area-inset-bottom))] sm:w-[min(560px,calc(100%-28px))] sm:rounded-[34px]"
          style={theme.cssVars}
        >
          <div className="max-h-[86dvh] overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 sm:max-h-[calc(100dvh-32px)] sm:px-6">
            <Drawer.Handle className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-900/18 dark:bg-white/24" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70 dark:text-slate-300/70">Air Conditioner</p>
              <div className="mt-1 flex min-w-0 items-center gap-2">
                <Drawer.Title className="overflow-wrap-anywhere text-4xl font-bold leading-none text-slate-950 dark:text-white">{getDisplayName(activeUnit)}</Drawer.Title>
                <button
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-white/14 text-slate-700 transition hover:bg-white/24 focus:outline-none disabled:opacity-50 dark:bg-slate-950/38 dark:text-slate-200 dark:hover:bg-slate-950/50"
                  type="button"
                  onClick={() => setEditingAlias((value) => !value)}
                  disabled={panelDisabled}
                  aria-label="Edit name"
                >
                  <Edit3 className="size-4" />
                </button>
              </div>
              <Drawer.Description className="mt-2 text-sm font-semibold text-slate-600/75 dark:text-slate-300/75">{statusLine}</Drawer.Description>
            </div>
          </div>

          {editingAlias ? (
            <form className="mt-4 grid grid-cols-[1fr_auto] gap-2" onSubmit={submitAlias}>
              <input
                className="min-h-12 min-w-0 rounded-2xl bg-white/18 px-4 text-slate-950 outline-none transition focus:bg-white/28 dark:border dark:border-white/10 dark:bg-slate-950/38 dark:text-white dark:focus:bg-slate-950/50"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                maxLength={18}
                autoComplete="off"
                placeholder="Unit name"
                disabled={panelDisabled}
              />
              <button
                className="min-h-12 rounded-full bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                type="submit"
                disabled={panelDisabled}
              >
                Save
              </button>
            </form>
          ) : null}

          <section className="mt-5 overflow-hidden rounded-[30px] bg-white/16 p-4 shadow-inner shadow-white/20 backdrop-blur-xl dark:bg-slate-950/42 dark:shadow-white/5">
            <div className="relative mx-auto grid min-h-64 w-full max-w-[430px] grid-cols-[56px_1fr_56px] items-end gap-4 pb-3">
              <TemperatureDial unit={activeUnit} minTemp={minTemp} maxTemp={maxTemp} theme={theme} />
              <StepButton
                label="Decrease temperature"
                icon={<Minus className="size-5" />}
                disabled={tempDisabled || activeUnit.tempSet <= minTemp}
                onClick={() => onUpdate({ tempSet: Math.max(minTemp, activeUnit.tempSet - 1) })}
              />
              <div className="relative z-10 grid justify-items-center gap-1">
                <strong className="text-7xl font-bold leading-none tracking-normal text-slate-950 dark:text-white">{activeUnit.tempSet}°</strong>
                <span className="text-sm font-bold text-slate-600/70 dark:text-slate-300/70">Target</span>
              </div>
              <StepButton
                label="Increase temperature"
                icon={<Plus className="size-5" />}
                disabled={tempDisabled || activeUnit.tempSet >= maxTemp}
                onClick={() => onUpdate({ tempSet: Math.min(maxTemp, activeUnit.tempSet + 1) })}
              />
            </div>
          </section>

          <section className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3 rounded-[26px] bg-white/14 px-4 py-3 backdrop-blur-xl dark:bg-slate-950/38">
            <QuickLabel icon={<Power className="size-5" />} label="Power" value={activeUnit.on === 1 ? "On" : "Off"} />
            <PowerSwitch checked={activeUnit.on === 1} disabled={powerDisabled} onChange={updatePower} />
          </section>

          <section className="mt-3 grid gap-3">
            <OptionRail
              label="Mode"
              value={activeUnit.mode}
              options={getPrimaryModeOptions(modes)}
              disabled={modeDisabled}
              iconFor={getModeIcon}
              shortLabelFor={getModeShortLabel}
              isSelected={(optionValue) => getPrimaryModeKey(optionValue) === getPrimaryModeKey(activeUnit.mode)}
              onChange={(value) => onUpdate({ mode: value })}
            />
            <OptionRail
              label="Fan"
              value={activeUnit.fan}
              options={fans}
              disabled={controlsDisabled}
              iconFor={getFanIcon}
              shortLabelFor={getFanShortLabel}
              isSelected={(optionValue) => optionValue === activeUnit.fan}
              onChange={(value) => onUpdate({ fan: value })}
            />
          </section>

          <button
            className="mt-3 flex min-h-12 w-full items-center justify-between rounded-[22px] bg-white/10 px-4 text-left text-sm font-bold text-slate-700 transition hover:bg-white/18 dark:bg-slate-950/30 dark:text-slate-200 dark:hover:bg-slate-950/44"
            type="button"
            onClick={() => setShowMore((value) => !value)}
            aria-expanded={showMore}
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="size-4" />
              More
            </span>
            <ChevronDown className={`size-4 transition ${showMore ? "rotate-180" : ""}`} />
          </button>

          {showMore ? (
            <section className="mt-3 grid gap-3">
              <OptionRail
                label="Vertical airflow"
                value={activeUnit.FlowDirection1}
                options={flow1Options}
                disabled={controlsDisabled}
                iconFor={() => ArrowUpDown}
                shortLabelFor={getFlowShortLabel}
                isSelected={(optionValue) => optionValue === activeUnit.FlowDirection1}
                onChange={(value) => onUpdate({ FlowDirection1: value })}
              />
              <OptionRail
                label="Horizontal airflow"
                value={activeUnit.FlowDirection2}
                options={flow2Options}
                disabled={controlsDisabled}
                iconFor={() => ArrowLeftRight}
                shortLabelFor={getFlowShortLabel}
                isSelected={(optionValue) => optionValue === activeUnit.FlowDirection2}
                onChange={(value) => onUpdate({ FlowDirection2: value })}
              />
            </section>
          ) : null}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function TemperatureDial({ unit, minTemp, maxTemp, theme }) {
  const range = Math.max(1, maxTemp - minTemp);
  const progress = Math.min(1, Math.max(0, (unit.tempSet - minTemp) / range));
  const angle = 230 * progress;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 grid h-56 place-items-center overflow-hidden">
      <div
        className="absolute inset-x-2 top-1 aspect-[2/1] rounded-t-full"
        style={{
          background: `conic-gradient(from 245deg at 50% 100%, ${theme.accentStrong} 0deg, ${theme.accent} ${angle}deg, rgba(15, 23, 42, 0.14) ${angle}deg, rgba(15, 23, 42, 0.14) 230deg, transparent 230deg)`,
          WebkitMask: "radial-gradient(ellipse at 50% 100%, transparent 0 54%, black 55% 70%, transparent 71%)",
          mask: "radial-gradient(ellipse at 50% 100%, transparent 0 54%, black 55% 70%, transparent 71%)"
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function StepButton({ label, icon, disabled, onClick }) {
  return (
    <button
      className="grid size-14 place-items-center rounded-full bg-white/12 text-slate-950 shadow-sm shadow-slate-900/5 transition hover:bg-white/22 focus:outline-none disabled:opacity-45 dark:bg-slate-950/38 dark:text-white dark:shadow-black/20 dark:hover:bg-slate-950/50"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function QuickLabel({ icon, label, value }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/12 text-slate-700 dark:bg-slate-950/34 dark:text-slate-200">{icon}</span>
      <span className="grid min-w-0">
        <span className="text-base font-bold text-slate-800 dark:text-white">{label}</span>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{value}</span>
      </span>
    </span>
  );
}

function PowerSwitch({ checked, disabled, onChange }) {
  return (
    <Switch.Root
      className={`relative h-9 w-16 rounded-full transition focus:outline-none ${checked ? "bg-[var(--mode-accent)]" : "bg-slate-900/20 dark:bg-white/20"} ${disabled ? "opacity-50" : ""}`}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label="Power"
    >
      <Switch.Thumb className={`absolute left-1 top-1 size-7 rounded-full bg-white shadow-md shadow-slate-900/20 transition ${checked ? "translate-x-7" : ""}`} />
    </Switch.Root>
  );
}

function OptionRail({ label, value, options, disabled, iconFor, shortLabelFor, isSelected, onChange }) {
  return (
    <section className="rounded-[26px] bg-white/10 px-3 py-3 backdrop-blur-xl dark:bg-slate-950/34">
      <div className="mb-3 px-1 text-sm font-bold text-slate-600/80 dark:text-slate-300/80">{label}</div>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-6" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = isSelected(option.value, value);
          const Icon = iconFor(option.value);

          return (
            <button
              key={option.value}
              className={`grid justify-items-center gap-2 text-xs font-bold transition focus:outline-none disabled:opacity-45 ${selected ? "text-slate-950 dark:text-white" : "text-slate-600/70 dark:text-slate-300/70"}`}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label} ${option.label}`}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              <span className={`grid size-12 place-items-center rounded-full transition ${selected ? "bg-[var(--mode-accent)] text-white shadow-sm shadow-black/5" : "bg-white/10 text-slate-700 hover:bg-white/18 dark:bg-slate-950/34 dark:text-slate-200 dark:hover:bg-slate-950/48"}`}>
                <Icon className="size-5" />
              </span>
              <span className="max-w-16 truncate">{shortLabelFor(option)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getModeIcon(value) {
  if (value === 1) return Snowflake;
  if ([2, 3, 5].includes(value)) return Droplets;
  if (value === 4) return Wind;
  if (value === 6) return Moon;
  if ([8, 9, 10].includes(value)) return Flame;
  return CloudSun;
}

function getPrimaryModeOptions(modes) {
  const allowedKeys = ["cool", "dry", "air", "heat"];
  const optionsByKey = new Map();

  for (const option of modes) {
    const key = getPrimaryModeKey(option.value);
    if (!allowedKeys.includes(key) || optionsByKey.has(key)) continue;
    optionsByKey.set(key, {
      ...option,
      label: getPrimaryModeLabel(key)
    });
  }

  return allowedKeys.map((key) => optionsByKey.get(key)).filter(Boolean);
}

function getPrimaryModeKey(value) {
  if (value === 1) return "cool";
  if ([2, 3, 5].includes(value)) return "dry";
  if (value === 4) return "air";
  if ([8, 9, 10].includes(value)) return "heat";
  return "auto";
}

function getPrimaryModeLabel(key) {
  const labels = {
    cool: "Cool",
    dry: "Dry",
    air: "Air",
    heat: "Heat"
  };

  return labels[key] || "Auto";
}

function getModeShortLabel(option) {
  return getPrimaryModeLabel(getPrimaryModeKey(option.value)) || option.label;
}

function getFanIcon(value) {
  if (value === 0) return Sparkles;
  if (value === 6) return Waves;
  return Wind;
}

function getFanShortLabel(option) {
  const labels = {
    0: "Auto",
    1: "High",
    2: "Med",
    4: "Low",
    6: "Quiet"
  };

  return labels[option.value] || option.label;
}

function getFlowShortLabel(option) {
  return option.value === 0 ? "Keep" : `P${option.value}`;
}

function getModeTheme(mode) {
  const themes = {
    1: modeTheme("#38bdf8", "#0284c7", "rgba(56, 189, 248, 0.24)"), // Cooling
    2: modeTheme("#fbbf24", "#d97706", "rgba(251, 191, 36, 0.22)"), // Dehumidify
    3: modeTheme("#fbbf24", "#d97706", "rgba(251, 191, 36, 0.22)"), // Comfort Dry
    4: modeTheme("#22d3ee", "#0891b2", "rgba(34, 211, 238, 0.22)"), // Fresh Air
    5: modeTheme("#fbbf24", "#d97706", "rgba(251, 191, 36, 0.22)"), // Auto Dehumidify
    6: modeTheme("#a78bfa", "#7c3aed", "rgba(167, 139, 250, 0.24)"), // Sleep
    8: modeTheme("#fb923c", "#ea580c", "rgba(251, 146, 60, 0.24)"), // Heating
    9: modeTheme("#fb923c", "#ea580c", "rgba(251, 146, 60, 0.24)"), // Floor Heating
    10: modeTheme("#fb923c", "#ea580c", "rgba(251, 146, 60, 0.24)") // Strong Heating
  };

  return themes[mode] || modeTheme("#60a5fa", "#2563eb", "rgba(96, 165, 250, 0.22)");
}

function modeTheme(accent, accentStrong, accentRing) {
  return {
    accent,
    accentStrong,
    cssVars: {
      "--mode-accent": accent,
      "--mode-accent-strong": accentStrong,
      "--mode-accent-ring": accentRing
    }
  };
}
