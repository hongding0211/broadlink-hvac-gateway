import { useEffect, useState } from "react";
import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";
import { Drawer } from "vaul";
import { Check, ChevronDown, Edit3, Minus, Plus, Power, X } from "lucide-react";
import { flow1Options, flow2Options, getDisplayName, getStateName } from "../lib/hvac.js";

export function DetailPanel({ unit, modes, fans, busy, onClose, onSaveAlias, onUpdate }) {
  const [editingAlias, setEditingAlias] = useState(false);
  const [alias, setAlias] = useState("");

  useEffect(() => {
    setEditingAlias(false);
    setAlias(unit?.alias || "");
  }, [unit?.idx]);

  if (!unit) return null;

  const disabled = busy;
  const tempLocked = unit.tempLock === 1;
  const minTemp = tempLocked ? unit.lowestVal || 16 : 16;
  const maxTemp = tempLocked ? unit.highestVal || 32 : 32;

  async function submitAlias(event) {
    event.preventDefault();
    await onSaveAlias(alias.trim());
    setEditingAlias(false);
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
        <Drawer.Overlay className="fixed inset-0 z-20 bg-slate-900/25 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-30 max-h-[calc(100dvh-24px)] w-[min(520px,calc(100%-28px))] -translate-x-1/2 overflow-auto rounded-[28px] border border-white/75 bg-white/75 px-4 pb-4 pt-2 text-slate-950 shadow-2xl shadow-slate-900/25 backdrop-blur-2xl outline-none transition sm:px-5">
          <Drawer.Handle className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-900/20" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70">Air Conditioner</p>
              <div className="mt-1 flex items-center gap-2">
                <Drawer.Title className="overflow-wrap-anywhere text-3xl font-bold leading-tight">{getDisplayName(unit)}</Drawer.Title>
                <button
                  className="grid size-8 place-items-center rounded-full bg-white/55 text-slate-700 transition hover:bg-white/75 disabled:opacity-50"
                  type="button"
                  onClick={() => setEditingAlias((value) => !value)}
                  disabled={disabled}
                  aria-label="Edit name"
                >
                  <Edit3 className="size-4" />
                </button>
              </div>
            </div>
            <button
              className="grid size-11 place-items-center rounded-2xl border border-white/70 bg-white/55 text-slate-950 shadow-lg shadow-slate-900/10 transition hover:bg-white/75"
              type="button"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
          <Drawer.Description className="sr-only">HVAC unit controls</Drawer.Description>

          {editingAlias ? (
            <form className="mt-4 grid grid-cols-[1fr_auto] gap-2" onSubmit={submitAlias}>
              <input
                className="min-h-11 min-w-0 rounded-2xl border border-white/80 bg-white/55 px-3 text-slate-950 outline-none ring-teal-600/20 transition focus:ring-4"
                value={alias}
                onChange={(event) => setAlias(event.target.value)}
                maxLength={18}
                autoComplete="off"
                placeholder="Unit name"
                disabled={disabled}
              />
              <button
                className="min-h-11 rounded-2xl border border-white/80 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
                type="submit"
                disabled={disabled}
              >
                Save
              </button>
            </form>
          ) : null}

          <section className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatusItem label="Status" value={getStateName(unit)} />
            <StatusItem label="Room temperature" value={`${unit.tempIn}°`} />
            <StatusItem label="Target temperature" value={`${unit.tempSet}°`} />
          </section>

          <section className="mt-4 grid grid-cols-[56px_1fr_56px] items-center gap-3 rounded-3xl bg-white/45 p-4">
            <StepButton
              label="Decrease temperature"
              icon={<Minus className="size-5" />}
              disabled={disabled || unit.tempSet <= minTemp}
              onClick={() => onUpdate({ tempSet: Math.max(minTemp, unit.tempSet - 1) })}
            />
            <div className="grid justify-items-center gap-1">
              <strong className="text-6xl font-bold leading-none">{unit.tempSet}°</strong>
              <span className="text-sm font-semibold text-slate-600/75">Target temperature</span>
            </div>
            <StepButton
              label="Increase temperature"
              icon={<Plus className="size-5" />}
              disabled={disabled || unit.tempSet >= maxTemp}
              onClick={() => onUpdate({ tempSet: Math.min(maxTemp, unit.tempSet + 1) })}
            />
          </section>

          <section className="mt-4 grid gap-2">
            <PowerRow checked={unit.on === 1} disabled={disabled} onChange={(checked) => onUpdate({ on: checked ? 1 : 0 })} />
            <SelectRow label="Mode" value={unit.mode} options={modes} disabled={disabled} onChange={(value) => onUpdate({ mode: value })} />
            <SelectRow label="Fan speed" value={unit.fan} options={fans} disabled={disabled} onChange={(value) => onUpdate({ fan: value })} />
            <SelectRow label="Vertical airflow" value={unit.FlowDirection1} options={flow1Options} disabled={disabled} onChange={(value) => onUpdate({ FlowDirection1: value })} />
            <SelectRow label="Horizontal airflow" value={unit.FlowDirection2} options={flow2Options} disabled={disabled} onChange={(value) => onUpdate({ FlowDirection2: value })} />
          </section>

          <section className="mt-4 flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3">
            <span className="text-sm font-semibold text-slate-600/75">Schedule</span>
            <strong className="text-sm font-bold text-slate-500">Coming soon</strong>
          </section>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function StatusItem({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/45 p-3">
      <span className="block text-sm font-semibold text-slate-600/75">{label}</span>
      <strong className="mt-1 block overflow-wrap-anywhere text-lg font-bold">{value}</strong>
    </div>
  );
}

function StepButton({ label, icon, disabled, onClick }) {
  return (
    <button
      className="grid size-14 place-items-center rounded-2xl border border-white/80 bg-white/55 text-slate-950 transition hover:bg-white/75 disabled:opacity-45"
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

function PowerRow({ checked, disabled, onChange }) {
  return (
    <label className="grid min-h-14 cursor-pointer grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-white/45 px-4 py-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Power className="size-4" />
        Power
      </span>
      <Switch.Root
        className={`relative h-8 w-14 rounded-full transition focus:outline-none focus:ring-4 focus:ring-teal-600/20 ${checked ? "bg-teal-700" : "bg-slate-900/25"} ${disabled ? "opacity-50" : ""}`}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      >
        <Switch.Thumb className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow-md shadow-slate-900/20 transition ${checked ? "translate-x-6" : ""}`} />
      </Switch.Root>
    </label>
  );
}

function SelectRow({ label, value, options, disabled, onChange }) {
  return (
    <Select.Root
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(Number(nextValue));
      }}
    >
      <div className="grid min-h-14 grid-cols-1 items-center gap-2 rounded-2xl bg-white/45 px-4 py-3 sm:grid-cols-[1fr_minmax(156px,auto)]">
        <Select.Label className="text-sm font-semibold text-slate-600/75">{label}</Select.Label>
        <Select.Trigger
          className="grid min-h-11 w-full grid-cols-[1fr_auto] items-center gap-3 rounded-2xl border border-white/80 bg-white/55 px-3 text-left text-slate-950 outline-none ring-teal-600/20 transition hover:bg-white/70 focus:ring-4 disabled:opacity-50"
          aria-label={label}
        >
          <Select.Value />
          <Select.Icon>
            <ChevronDown className="size-4 text-slate-600/75" />
          </Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner className="z-50" sideOffset={6} alignItemWithTrigger={false}>
          <Select.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-auto rounded-2xl border border-white/75 bg-white/95 p-1 text-slate-950 shadow-2xl shadow-slate-900/20 backdrop-blur-xl outline-none">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="grid min-h-11 cursor-pointer grid-cols-[20px_1fr] items-center gap-2 rounded-xl px-3 text-sm font-semibold outline-none transition data-[highlighted]:bg-teal-50 data-[selected]:text-teal-800"
                >
                  <Select.ItemIndicator>
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
