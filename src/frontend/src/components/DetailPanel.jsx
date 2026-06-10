import { useEffect, useRef, useState } from "react";
import { Switch } from "@base-ui/react/switch";
import { Drawer } from "vaul";
import {
  CalendarClock,
  Check,
  CloudSun,
  Droplets,
  Edit3,
  Ellipsis,
  Flame,
  Minus,
  Moon,
  Plus,
  Power,
  Snowflake,
  Sparkles,
  Waves,
  Wind,
  X
} from "lucide-react";
import { getDisplayName, getStateName } from "../lib/hvac.js";

export function DetailPanel({ unit, modes, fans, busy, preference = {}, timers = [], onClose, onSaveAlias, onUpdate, onUpdatePreference, onUpdateTimerPatch, onSaveTimer, onDeleteTimer }) {
  const closeTimerRef = useRef(null);
  const [displayedUnit, setDisplayedUnit] = useState(unit);
  const [editingAlias, setEditingAlias] = useState(false);
  const [alias, setAlias] = useState("");
  const offTimer = timers.find((timer) => timer.action === "off");
  const onTimer = timers.find((timer) => timer.action === "on");

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
  }, [unit?.idx]);

  const activeUnit = unit || displayedUnit;
  if (!activeUnit) return null;

  const panelDisabled = busy;
  const editingPreference = activeUnit.on !== 1;
  const controlUnit = editingPreference ? applyPreferencePatch(activeUnit, preference, modes, fans) : activeUnit;
  const controlsDisabled = panelDisabled;
  const powerDisabled = panelDisabled || activeUnit.OnoffLock === 1;
  const modeDisabled = controlsDisabled || activeUnit.modeLock === 1;
  const tempLocked = activeUnit.tempLock === 1;
  const minTemp = tempLocked ? activeUnit.lowestVal || 16 : 16;
  const maxTemp = tempLocked ? activeUnit.highestVal || 32 : 32;
  const tempDisabled = controlsDisabled || minTemp >= maxTemp;
  const statusLine =
    editingPreference
      ? `${getStateName(activeUnit)} · Next ${controlUnit.tempSet}° · ${controlUnit.modeLabel} · ${controlUnit.fanLabel}`
      : activeUnit.on === 1
      ? `${getStateName(activeUnit)} · Room ${activeUnit.tempIn}° · ${activeUnit.modeLabel}`
      : `${getStateName(activeUnit)} · Room ${activeUnit.tempIn}°`;
  const theme = getModeTheme(controlUnit.mode);

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
    const startPatch = {
      on: 1,
      mode: controlUnit.mode,
      tempSet: controlUnit.tempSet,
      fan: controlUnit.fan
    };
    onUpdate(hasAutoFan && !Object.hasOwn(preference, "fan") ? { ...startPatch, fan: 0 } : startPatch);
  }

  function updateControl(patch) {
    if (editingPreference) {
      onUpdatePreference(activeUnit.idx, patch);
      return;
    }

    onUpdate(patch);
  }

  function getDefaultOnTimerPatch() {
    const hasAutoFan = fans.some((option) => option.value === 0);
    return {
      on: 1,
      mode: controlUnit.mode,
      tempSet: controlUnit.tempSet,
      fan: Object.hasOwn(preference, "fan") || activeUnit.on === 1 ? controlUnit.fan : hasAutoFan ? 0 : controlUnit.fan
    };
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
              <TemperatureDial unit={controlUnit} minTemp={minTemp} maxTemp={maxTemp} theme={theme} />
              <StepButton
                label="Decrease temperature"
                icon={<Minus className="size-5" />}
                disabled={tempDisabled || controlUnit.tempSet <= minTemp}
                onClick={() => updateControl({ tempSet: Math.max(minTemp, controlUnit.tempSet - 1) })}
              />
              <div className="relative z-10 grid justify-items-center gap-1">
                <strong className="text-7xl font-bold leading-none tracking-normal text-slate-950 dark:text-white">{controlUnit.tempSet}°</strong>
                <span className="text-sm font-bold text-slate-600/70 dark:text-slate-300/70">{editingPreference ? "Next target" : "Target"}</span>
              </div>
              <StepButton
                label="Increase temperature"
                icon={<Plus className="size-5" />}
                disabled={tempDisabled || controlUnit.tempSet >= maxTemp}
                onClick={() => updateControl({ tempSet: Math.min(maxTemp, controlUnit.tempSet + 1) })}
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
              value={controlUnit.mode}
              options={getPrimaryModeOptions(modes)}
              disabled={modeDisabled}
              iconFor={getModeIcon}
              shortLabelFor={getModeShortLabel}
              isSelected={(optionValue) => getPrimaryModeKey(optionValue) === getPrimaryModeKey(controlUnit.mode)}
              onChange={(value) => updateControl({ mode: value })}
            />
            <OptionRail
              label="Fan"
              value={controlUnit.fan}
              options={fans}
              disabled={controlsDisabled}
              iconFor={getFanIcon}
              shortLabelFor={getFanShortLabel}
              isSelected={(optionValue) => optionValue === controlUnit.fan}
              onChange={(value) => updateControl({ fan: value })}
            />
          </section>

          <section className="mt-3 rounded-[26px] bg-white/10 px-3 py-3 backdrop-blur-xl dark:bg-slate-950/34">
            <div className="grid gap-4">
              <TimerRow
                label="Off"
                action="off"
                timer={offTimer}
                disabled={panelDisabled}
                onSchedule={(runAt, presetMinutes) => onSaveTimer(activeUnit.idx, "off", runAt, presetMinutes)}
                onDelete={() => onDeleteTimer(activeUnit.idx, "off")}
              />
              <div className="mx-1 h-px bg-slate-900/8 dark:bg-white/10" />
              <TimerRow
                label="On"
                action="on"
                timer={onTimer}
                disabled={panelDisabled}
                schedulePatch={getDefaultOnTimerPatch()}
                onSchedule={(runAt, presetMinutes, patch) => onSaveTimer(activeUnit.idx, "on", runAt, presetMinutes, patch)}
                onDelete={() => onDeleteTimer(activeUnit.idx, "on")}
              />
            </div>
          </section>

          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

const quickTimerOptionsByAction = {
  off: [
    { label: "30m", minutes: 30 },
    { label: "1h", minutes: 60 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "4h", minutes: 240 },
    { label: "6h", minutes: 360 },
    { label: "8h", minutes: 480 }
  ],
  on: [
    { label: "30m", minutes: 30 },
    { label: "1h", minutes: 60 },
    { label: "8h", minutes: 480 }
  ]
};

function TimerRow({ label, action, timer, disabled, schedulePatch, onSchedule, onDelete }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customTime, setCustomTime] = useState("");
  const [optimisticTimer, setOptimisticTimer] = useState(undefined);
  const quickTimerOptions = quickTimerOptionsByAction[action] || quickTimerOptionsByAction.off;
  const selectedQuickMinutes = getSelectedQuickMinutes(timer, quickTimerOptions);
  const customTitle = action === "on" ? "On" : "Off";
  const displayedSelection = optimisticTimer === undefined ? selectedQuickMinutes : optimisticTimer.selection;
  const displayedRunAt = optimisticTimer?.runAt ?? timer?.runAt;
  const displayedPresetMinutes = optimisticTimer?.presetMinutes ?? timer?.presetMinutes;
  const moreSelected = displayedSelection === "more" || (optimisticTimer === undefined && Boolean(timer) && selectedQuickMinutes === null);
  const statusText = getTimerStatusText(action, displayedRunAt, displayedSelection);

  useEffect(() => {
    setOptimisticTimer(undefined);
  }, [timer?.runAt]);

  function confirmCustomTime() {
    if (!isTimeValue(customTime)) return;

    const runAt = resolveFutureRunAt(customTime);
    setOptimisticTimer({ selection: "more", runAt });
    onSchedule(runAt, null, schedulePatch);
    setCustomOpen(false);
  }

  return (
    <div className="px-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 text-sm font-bold text-slate-600/80 dark:text-slate-300/80">{label}</div>
        {statusText ? <div className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">{statusText}</div> : null}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label={label}>
        {quickTimerOptions.map((option) => (
          <TimerActionButton
            key={option.minutes}
            label={option.label}
            minutes={option.minutes}
            runAt={displayedSelection === option.minutes ? displayedRunAt : undefined}
            presetMinutes={displayedSelection === option.minutes ? displayedPresetMinutes : undefined}
            action={action}
            selected={displayedSelection === option.minutes}
            disabled={disabled}
            onClick={() => {
              if (displayedSelection === option.minutes) {
                setOptimisticTimer({ selection: "none" });
                onDelete();
                return;
              }

              const runAt = resolveOffsetRunAt(option.minutes);
              setOptimisticTimer({ selection: option.minutes, runAt, presetMinutes: option.minutes });
              onSchedule(runAt, option.minutes, schedulePatch);
            }}
          />
        ))}
        <TimerActionButton
          label="More"
          icon={<Ellipsis className="size-5" />}
          selected={moreSelected}
          disabled={disabled}
          onClick={() => {
            setCustomTime(toTimeValue(timer?.runAt));
            setCustomOpen(true);
          }}
        />
      </div>
      <Drawer.Root open={customOpen} onOpenChange={setCustomOpen} direction="bottom" fixed repositionInputs>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-black/18 backdrop-blur-sm dark:bg-black/42" />
          <Drawer.Content className="fixed bottom-0 left-1/2 z-50 w-full max-w-[560px] -translate-x-1/2 rounded-t-[30px] bg-white/88 px-5 pb-[max(36px,env(safe-area-inset-bottom))] pt-3 text-slate-950 shadow-2xl shadow-slate-900/20 backdrop-blur-2xl outline-none dark:border dark:border-white/12 dark:bg-slate-950/92 dark:text-white dark:shadow-black/50 sm:bottom-[max(16px,env(safe-area-inset-bottom))] sm:w-[min(560px,calc(100%-28px))] sm:rounded-[30px]">
            <Drawer.Handle className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-900/18 dark:bg-white/30" />
            <Drawer.Title className="text-xl font-bold text-slate-950 dark:text-white">{customTitle}</Drawer.Title>
            <label className="mt-5 grid gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Time</span>
              <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                <span className="relative grid min-w-0">
                  <span
                    className={`pointer-events-none absolute inset-0 grid place-items-center text-4xl font-bold tracking-normal text-slate-500/32 dark:text-white/24 ${customTime ? "opacity-0" : "opacity-100"}`}
                    aria-hidden="true"
                  >
                    --:--
                  </span>
                  <input
                    className="timer-sheet-time-input min-h-16 rounded-[24px] bg-white px-4 text-center text-4xl font-bold tracking-normal text-slate-950 outline-none shadow-sm shadow-slate-900/8 dark:border dark:border-white/10 dark:bg-slate-900/80 dark:text-white dark:shadow-black/24"
                    type="time"
                    step="60"
                    value={customTime}
                    onInput={(event) => setCustomTime(event.currentTarget.value)}
                    onChange={(event) => setCustomTime(event.currentTarget.value)}
                    disabled={disabled}
                    aria-label="Timer time"
                  />
                </span>
                <div className="flex items-center gap-2">
                  {timer ? (
                    <button
                      className="grid size-14 place-items-center rounded-full bg-white text-slate-500 shadow-sm shadow-slate-900/8 transition active:scale-95 disabled:opacity-45 dark:border dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 dark:shadow-black/24"
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setOptimisticTimer({ selection: "none" });
                        setCustomTime("");
                        onDelete();
                        setCustomOpen(false);
                      }}
                      aria-label="Clear timer"
                    >
                      <X className="size-6" strokeWidth={2.4} />
                    </button>
                  ) : null}
                  <button
                    className="grid size-14 place-items-center rounded-full bg-white text-[var(--mode-accent)] shadow-sm shadow-slate-900/8 transition active:scale-95 disabled:text-slate-300 disabled:shadow-none dark:border dark:border-white/10 dark:bg-slate-900/80 dark:disabled:text-slate-600 dark:shadow-black/24"
                    type="button"
                    disabled={disabled || !isTimeValue(customTime)}
                    onClick={confirmCustomTime}
                    aria-label="Confirm time"
                  >
                    <Check className="size-6" strokeWidth={2.6} />
                  </button>
                </div>
              </div>
            </label>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function TimerActionButton({ label, icon, minutes, runAt, presetMinutes, action, selected = false, disabled, onClick }) {
  const iconClassName =
    icon && selected
      ? "grid size-12 place-items-center rounded-full bg-[var(--mode-accent)] text-white opacity-100 shadow-sm shadow-sky-500/24 transition duration-200 ease-out"
      : `grid size-12 place-items-center rounded-full bg-white/18 text-slate-700 transition duration-200 ease-out dark:bg-slate-950/48 dark:text-slate-200 ${selected ? "opacity-100" : "opacity-75"}`;

  return (
    <button
      className={`grid min-w-0 justify-items-center gap-2 text-xs font-bold transition focus:outline-none disabled:opacity-45 ${selected ? "text-slate-950 dark:text-white" : "text-slate-600/70 dark:text-slate-300/70"}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
    >
      <span className={iconClassName}>
        {icon || <TimerPieIcon minutes={minutes} runAt={runAt} presetMinutes={presetMinutes} action={action} selected={selected} />}
      </span>
      <span className="max-w-16 truncate">{label}</span>
    </button>
  );
}

function TimerPieIcon({ minutes, runAt, presetMinutes, action, selected }) {
  const now = new Date();
  const startMinutes = now.getHours() * 60 + now.getMinutes();
  const startAngle = (startMinutes / (24 * 60)) * 360 - 90;
  const targetDate = getTimerIconTargetDate(runAt, minutes, now);
  const targetMinutes = targetDate.getHours() * 60 + targetDate.getMinutes();
  const targetClockAngle = (targetMinutes / (24 * 60)) * 360 - 90;
  const remainingMinutes = Math.max(0, (targetDate.getTime() - now.getTime()) / 60_000);
  const offStartAngle = getTimerStartAngle({ now, targetDate, presetMinutes, fallbackStartAngle: startAngle });
  const offEndAngle = runAt && presetMinutes ? offStartAngle + (presetMinutes / (24 * 60)) * 360 : startAngle + (remainingMinutes / (24 * 60)) * 360;
  const offPath = describePieSlice(32, 32, 31, offStartAngle, offEndAngle);
  const onStartAngle = getTimerStartAngle({ now, targetDate, presetMinutes, fallbackStartAngle: startAngle });
  const onEndAngle = runAt && presetMinutes ? onStartAngle + (presetMinutes / (24 * 60)) * 360 : startAngle + (remainingMinutes / (24 * 60)) * 360;
  const onActivePath = describePieSlice(32, 32, 31, onEndAngle, onStartAngle + 360);
  const timerIdleFill = "var(--timer-idle-fill)";
  const timerActiveFill = "var(--timer-active-fill)";
  const timerSelectedFill = "var(--mode-accent)";
  const idleFill = timerIdleFill;
  const activeFill = selected ? timerSelectedFill : timerActiveFill;
  const offHandAngle = runAt ? startAngle : offStartAngle;
  const onHandAngle = startAngle;
  const handAngle = action === "on" ? onHandAngle : offHandAngle;
  const handEnd = polarToCartesian(32, 32, 20, handAngle);

  return (
    <svg className="size-12" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="31" fill={idleFill} />
      {action === "on" ? (
        <>
          <path d={onActivePath} fill={activeFill} />
        </>
      ) : (
        <path d={offPath} fill={activeFill} />
      )}
      <line className="stroke-slate-700 dark:stroke-white/90" x1="32" y1="32" x2={handEnd.x} y2={handEnd.y} strokeWidth="2.4" strokeLinecap="round" />
      <circle className="fill-slate-700 dark:fill-white/90" cx="32" cy="32" r="3.2" />
    </svg>
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

function applyPreferencePatch(unit, preference, modes, fans) {
  const patch = preference || {};
  const nextUnit = { ...unit, ...patch };

  if (unit.on !== 1 && !Object.hasOwn(patch, "fan") && fans.some((item) => item.value === 0)) {
    nextUnit.fan = 0;
    nextUnit.fanLabel = fans.find((item) => item.value === 0)?.label || "Auto";
  }

  if (Object.hasOwn(patch, "mode")) {
    const option = modes.find((item) => item.value === Number(patch.mode));
    nextUnit.modeLabel = option?.label || `Mode ${patch.mode}`;
  }

  if (Object.hasOwn(patch, "fan")) {
    const option = fans.find((item) => item.value === Number(patch.fan));
    nextUnit.fanLabel = option?.label || `Fan ${patch.fan}`;
  }

  return nextUnit;
}

function toTimeValue(runAt) {
  if (!runAt) return "";
  const date = new Date(runAt);
  if (Number.isNaN(date.getTime())) return "";
  return formatTimeValue(date);
}

function formatOffsetTimeValue(minutes) {
  return formatTimeValue(new Date(Date.now() + minutes * 60_000));
}

function resolveOffsetRunAt(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function getSelectedQuickMinutes(timer, quickTimerOptions) {
  if (!timer) return undefined;
  if (timer.presetMinutes) return timer.presetMinutes;

  const target = new Date(timer.runAt).getTime();
  if (Number.isNaN(target)) return undefined;

  const remainingMinutes = Math.max(0, (target - Date.now()) / 60_000);
  const matchingOption = quickTimerOptions.find((option) => Math.abs(remainingMinutes - option.minutes) <= 2);
  return matchingOption?.minutes ?? null;
}

function getTimerIconTargetDate(runAt, minutes, now) {
  if (runAt) {
    const date = new Date(runAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return new Date(now.getTime() + minutes * 60_000);
}

function getTimerStartAngle({ now, targetDate, presetMinutes, fallbackStartAngle }) {
  if (!presetMinutes) return fallbackStartAngle;

  const originalStart = new Date(targetDate.getTime() - presetMinutes * 60_000);
  const originalStartMinutes = originalStart.getHours() * 60 + originalStart.getMinutes();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let startAngle = (originalStartMinutes / (24 * 60)) * 360 - 90;
  const nowAngle = (nowMinutes / (24 * 60)) * 360 - 90;

  while (startAngle > nowAngle) {
    startAngle -= 360;
  }

  return startAngle;
}

function getTimerStatusText(action, runAt, displayedSelection) {
  if (displayedSelection === "none") return "";
  const actionVerb = action === "on" ? "Start" : "Stop";

  if (runAt) {
    const target = new Date(runAt);
    if (Number.isNaN(target.getTime())) return "";

    return `${actionVerb}${formatTimerStatusSuffix(target)}`;
  }

  if (typeof displayedSelection === "number") {
    return `${actionVerb} at ${formatOffsetTimeValue(displayedSelection)}`;
  }

  return "";
}

function describePieSlice(cx, cy, radius, startAngle, endAngle, sweep = 1) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const delta = Math.abs(endAngle - startAngle);
  const largeArcFlag = delta > 180 ? 1 : 0;

  return [`M ${cx} ${cy}`, `L ${start.x} ${start.y}`, `A ${radius} ${radius} 0 ${largeArcFlag} ${sweep} ${end.x} ${end.y}`, "Z"].join(" ");
}

function polarToCartesian(cx, cy, radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians)
  };
}

function formatTimeValue(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatTimerStatusSuffix(date) {
  return isSameLocalDate(date, new Date()) ? ` at ${formatTimeValue(date)}` : ` tomorrow at ${formatTimeValue(date)}`;
}

function isSameLocalDate(left, right) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function resolveFutureRunAt(value) {
  if (!isTimeValue(value)) return "";

  const [hours, minutes] = value.split(":").map(Number);
  const now = new Date();
  const runAt = new Date(now);
  runAt.setHours(hours, minutes, 0, 0);

  if (runAt.getTime() <= now.getTime()) {
    runAt.setDate(runAt.getDate() + 1);
  }

  return runAt.toISOString();
}

function isTimeValue(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function getModeTheme(mode) {
  const themes = {
    1: modeTheme("#38bdf8", "#0284c7", "rgba(56, 189, 248, 0.24)"), // Cooling
    2: modeTheme("#2dd4bf", "#0f766e", "rgba(45, 212, 191, 0.22)"), // Dehumidify
    3: modeTheme("#2dd4bf", "#0f766e", "rgba(45, 212, 191, 0.22)"), // Comfort Dry
    4: modeTheme("#22d3ee", "#0891b2", "rgba(34, 211, 238, 0.22)"), // Fresh Air
    5: modeTheme("#2dd4bf", "#0f766e", "rgba(45, 212, 191, 0.22)"), // Auto Dehumidify
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
