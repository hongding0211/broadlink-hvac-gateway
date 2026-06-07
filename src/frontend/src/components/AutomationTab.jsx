import { useEffect, useMemo, useState } from "react";
import { Input } from "@base-ui/react/input";
import { Select } from "@base-ui/react/select";
import { Switch } from "@base-ui/react/switch";
import { Drawer } from "vaul";
import { CalendarClock, Check, ChevronDown, Plus, Trash2 } from "lucide-react";
import { api, getDisplayName } from "../lib/hvac.js";

const weekdays = [
  { value: "mon", label: "M" },
  { value: "tue", label: "T" },
  { value: "wed", label: "W" },
  { value: "thu", label: "T" },
  { value: "fri", label: "F" },
  { value: "sat", label: "S" },
  { value: "sun", label: "S" }
];

export function AutomationTab({ units, modes, fans }) {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [sheetMode, setSheetMode] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const firstUnit = units[0];
  const defaultMode = modes[0]?.value ?? 1;
  const defaultFan = fans[0]?.value ?? 0;
  const [draft, setDraft] = useState(() => createDraft(firstUnit?.idx ?? 0, defaultMode, defaultFan));

  useEffect(() => {
    void loadAutomations();
  }, []);

  useEffect(() => {
    setDraft((current) => normalizeDraftOptions(current, units, modes, fans, firstUnit?.idx ?? 0, defaultMode, defaultFan));
  }, [defaultFan, defaultMode, fans, firstUnit?.idx, modes, units]);

  const unitsByIdx = useMemo(() => new Map(units.map((unit) => [unit.idx, unit])), [units]);
  const selectedAutomation = automations.find((automation) => automation.id === selectedId) || null;
  const sheetOpen = sheetMode !== null;

  async function loadAutomations() {
    setLoading(true);
    try {
      const payload = await api("/api/automations");
      setAutomations(payload.automations);
      setError("");
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreateSheet() {
    setDraft(createDraft(firstUnit?.idx ?? 0, defaultMode, defaultFan));
    setSelectedId("");
    setSheetMode("create");
  }

  function openDetailSheet(automation) {
    setDraft(toDraft(automation));
    setSelectedId(automation.id);
    setSheetMode("detail");
  }

  function closeSheet() {
    setSheetMode(null);
    setSelectedId("");
  }

  async function saveAutomation(event) {
    event.preventDefault();
    const isCreate = sheetMode === "create";
    const busyKey = isCreate ? "new" : selectedId;
    setBusyId(busyKey);

    try {
      const payload = await api(isCreate ? "/api/automations" : `/api/automations/${selectedId}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toPayload(draft))
      });

      setAutomations((current) =>
        isCreate
          ? [payload.automation, ...current]
          : current.map((automation) => (automation.id === selectedId ? payload.automation : automation))
      );
      setError("");
      closeSheet();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusyId("");
    }
  }

  async function toggleAutomation(id, enabled) {
    setBusyId(id);
    try {
      const payload = await api(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled })
      });
      setAutomations((current) =>
        current.map((automation) => (automation.id === id ? payload.automation : automation))
      );
      setError("");
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusyId("");
    }
  }

  async function removeAutomation(id) {
    setBusyId(id);
    try {
      await api(`/api/automations/${id}`, { method: "DELETE" });
      setAutomations((current) => current.filter((automation) => automation.id !== id));
      setError("");
      if (selectedId === id) closeSheet();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="grid gap-4 pt-2">
      {error ? (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
          {error}
        </section>
      ) : null}

      <section className="grid gap-3" aria-live="polite" aria-busy={loading}>
        {!loading && automations.length === 0 ? (
          <div className="grid min-h-36 place-items-center rounded-[28px] bg-white/14 px-5 text-center text-sm font-semibold text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur-2xl dark:border dark:border-white/10 dark:bg-slate-950/38 dark:text-slate-300 dark:shadow-black/25">
            No automations
          </div>
        ) : null}
        {automations.map((automation) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            unitLabel={formatUnitNames(automation.unitIdxs || [automation.unitIdx], unitsByIdx)}
            modeLabel={findLabel(modes, automation.mode)}
            fanLabel={findLabel(fans, automation.fan)}
            busy={busyId === automation.id}
            onOpen={() => openDetailSheet(automation)}
            onToggle={(enabled) => toggleAutomation(automation.id, enabled)}
          />
        ))}
      </section>

      <button
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-[26px] border border-white/35 bg-white/28 px-5 text-base font-bold text-slate-950 shadow-lg shadow-slate-900/5 backdrop-blur-2xl transition hover:bg-white/38 focus:outline-none disabled:opacity-45 dark:border-white/12 dark:bg-slate-950/38 dark:text-white dark:shadow-black/24 dark:hover:bg-slate-950/48"
        type="button"
        onClick={openCreateSheet}
        disabled={units.length === 0 || modes.length === 0 || fans.length === 0}
      >
        <Plus className="size-5" />
        New automation
      </button>

      <AutomationSheet
        open={sheetOpen}
        mode={sheetMode}
        draft={draft}
        units={units}
        modes={modes}
        fans={fans}
        busy={busyId === "new" || (selectedId ? busyId === selectedId : false)}
        selectedAutomation={selectedAutomation}
        onClose={closeSheet}
        onChange={setDraft}
        onSave={saveAutomation}
        onDelete={selectedAutomation ? () => removeAutomation(selectedAutomation.id) : null}
      />
    </section>
  );
}

function AutomationCard({ automation, unitLabel, modeLabel, fanLabel, busy, onOpen, onToggle }) {
  return (
    <article className="rounded-[28px] bg-white/14 shadow-lg shadow-slate-900/5 backdrop-blur-2xl dark:border dark:border-white/10 dark:bg-slate-950/40 dark:shadow-black/25">
      <button className="grid w-full gap-3 p-4 text-left focus:outline-none" type="button" onClick={onOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="overflow-wrap-anywhere text-xl font-bold leading-tight text-slate-950 dark:text-white">{automation.name}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600/75 dark:text-slate-300/75">
              {unitLabel} · {automation.time}
            </p>
          </div>
          <Switch.Root
            className={`relative h-8 w-14 shrink-0 rounded-full transition focus:outline-none disabled:opacity-45 ${automation.enabled ? "bg-emerald-500/75 backdrop-blur-xl" : "bg-slate-900/18 dark:bg-white/18"}`}
            checked={automation.enabled}
            disabled={busy}
            onClick={(event) => event.stopPropagation()}
            onCheckedChange={onToggle}
            aria-label={`${automation.name} enabled`}
          >
            <Switch.Thumb className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow-md shadow-slate-900/20 transition ${automation.enabled ? "translate-x-6" : ""}`} />
          </Switch.Root>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 dark:bg-slate-950/34">
            <CalendarClock className="size-4" />
          </span>
          <span className="min-w-0 truncate">
            {automation.tempSet}° · {modeLabel} · {fanLabel} · {formatDays(automation.days)}
          </span>
        </div>
      </button>
    </article>
  );
}

function AutomationSheet({ open, mode, draft, units, modes, fans, busy, selectedAutomation, onClose, onChange, onSave, onDelete }) {
  const title = mode === "create" ? "New automation" : selectedAutomation?.name || "Automation";

  return (
    <Drawer.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()} direction="bottom" fixed repositionInputs>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-20 bg-white/5 opacity-0 backdrop-blur-sm transition-opacity duration-150 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 dark:bg-black/48" />
        <Drawer.Content className="fixed bottom-0 left-1/2 z-30 w-full max-w-[560px] -translate-x-1/2 overflow-hidden rounded-t-[34px] bg-white/86 text-slate-950 shadow-xl shadow-slate-900/14 backdrop-blur-xl outline-none transition dark:border dark:border-white/12 dark:bg-slate-950/90 dark:text-white dark:shadow-black/45 sm:bottom-[max(16px,env(safe-area-inset-bottom))] sm:w-[min(560px,calc(100%-28px))] sm:rounded-[34px]">
          <form className="max-h-[86dvh] overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 sm:max-h-[calc(100dvh-32px)] sm:px-6" onSubmit={onSave}>
            <Drawer.Handle className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-900/18 dark:bg-white/24" />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70 dark:text-slate-300/70">Automation</p>
                <Drawer.Title className="mt-1 overflow-wrap-anywhere text-4xl font-bold leading-none text-slate-950 dark:text-white">{title}</Drawer.Title>
                <Drawer.Description className="mt-2 text-sm font-semibold text-slate-600/75 dark:text-slate-300/75">
                  {mode === "create" ? "Create a shared backend rule" : "Shared backend rule"}
                </Drawer.Description>
              </div>
              {onDelete ? (
                <button
                  className="grid size-11 shrink-0 place-items-center rounded-full bg-white/14 text-slate-700 transition hover:bg-white/24 focus:outline-none disabled:opacity-45 dark:bg-slate-950/38 dark:text-slate-200 dark:hover:bg-slate-950/50"
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  aria-label={`Delete ${selectedAutomation?.name || "automation"}`}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-5 grid gap-3">
              <label className="grid gap-2">
                <span className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">Name</span>
                <Input
                  className="min-h-12 min-w-0 rounded-2xl border border-white/40 bg-white/78 px-4 text-base font-semibold text-slate-950 shadow-sm shadow-slate-900/4 outline-none transition placeholder:text-slate-500/65 focus:border-slate-900/10 dark:border-white/10 dark:bg-slate-900/82 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-white/16"
                  value={draft.name}
                  onValueChange={(value) => onChange({ ...draft, name: value })}
                  maxLength={24}
                  autoComplete="off"
                  placeholder="Morning comfort"
                  required
                />
              </label>

              <div className="grid gap-3">
                <UnitMultiSelect
                  units={units}
                  selectedUnitIdxs={draft.unitIdxs}
                  onChange={(unitIdxs) => onChange({ ...draft, unitIdxs })}
                />
                <label className="grid gap-2">
                  <span className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">Time</span>
                  <Input
                    className="min-h-12 min-w-0 rounded-2xl border border-white/40 bg-white/78 px-3 text-base font-semibold text-slate-950 shadow-sm shadow-slate-900/4 outline-none transition focus:border-slate-900/10 dark:border-white/10 dark:bg-slate-900/82 dark:text-white dark:focus:border-white/16"
                    type="time"
                    value={draft.time}
                    onValueChange={(value) => onChange({ ...draft, time: value })}
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SelectField label="Mode" value={draft.mode} onChange={(value) => onChange({ ...draft, mode: value })} options={modes} />
                <SelectField label="Fan" value={draft.fan} onChange={(value) => onChange({ ...draft, fan: value })} options={fans} />
                <label className="grid gap-2">
                  <span className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">Temp</span>
                  <Input
                    className="min-h-12 min-w-0 rounded-2xl border border-white/40 bg-white/78 px-3 text-base font-semibold text-slate-950 shadow-sm shadow-slate-900/4 outline-none transition focus:border-slate-900/10 dark:border-white/10 dark:bg-slate-900/82 dark:text-white dark:focus:border-white/16"
                    type="number"
                    min="16"
                    max="32"
                    value={draft.tempSet}
                    onValueChange={(value) => onChange({ ...draft, tempSet: value })}
                    required
                  />
                </label>
              </div>

              <div className="grid grid-cols-7 gap-2" aria-label="Repeat days">
                {weekdays.map((day) => {
                  const selected = draft.days.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      className={`grid aspect-square place-items-center rounded-full text-sm font-bold transition focus:outline-none ${
                        selected
                          ? "border border-sky-300/70 bg-sky-400 text-white shadow-sm shadow-sky-900/12 dark:border-sky-300/45 dark:bg-sky-400 dark:text-white dark:shadow-black/20"
                          : "border border-slate-900/5 bg-slate-50 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                      }`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => onChange({ ...draft, days: toggleDay(draft.days, day.value) })}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full border border-white/40 bg-white/72 px-5 text-sm font-bold text-slate-950 shadow-sm shadow-slate-900/8 transition hover:bg-white/86 focus:outline-none disabled:opacity-45 dark:border-white/12 dark:bg-slate-800/86 dark:text-white dark:shadow-black/20 dark:hover:bg-slate-700"
              type="submit"
              disabled={busy || units.length === 0 || modes.length === 0 || fans.length === 0}
            >
              {mode === "create" ? "Create automation" : "Save changes"}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function SelectField({ label, value, options, onChange }) {
  const selectOptions = options.map((option) => ({ ...option, value: String(option.value) }));
  const normalizedValue = selectOptions.some((option) => option.value === String(value)) ? String(value) : selectOptions[0]?.value;
  const selectedLabel = selectOptions.find((option) => option.value === normalizedValue)?.label || "";

  return (
    <div className="grid min-w-0 gap-2">
      <span className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
      <Select.Root value={normalizedValue} onValueChange={(nextValue) => onChange(nextValue)} modal={false}>
        <Select.Trigger
          className="flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-2xl border border-white/40 bg-white/78 px-3 text-left text-base font-semibold text-slate-950 shadow-sm shadow-slate-900/4 outline-none transition hover:bg-white/88 focus:border-slate-900/10 data-[popup-open]:border-slate-900/10 dark:border-white/10 dark:bg-slate-900/82 dark:text-white dark:hover:bg-slate-800 dark:focus:border-white/16 dark:data-[popup-open]:border-white/16"
          type="button"
          aria-label={label}
        >
          <Select.Value>{selectedLabel}</Select.Value>
          <Select.Icon className="grid size-5 shrink-0 place-items-center text-slate-700 dark:text-slate-200">
            <ChevronDown className="size-4" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Positioner className="z-50" sideOffset={8} alignItemWithTrigger={false}>
          <Select.Popup className="max-h-64 min-w-[var(--anchor-width)] overflow-y-auto rounded-2xl border border-slate-900/8 bg-white p-1 text-slate-950 shadow-xl shadow-slate-900/14 dark:border-white/12 dark:bg-slate-900 dark:text-white dark:shadow-black/35">
            <Select.List>
              {selectOptions.map((option) => (
                <Select.Item
                  key={option.value}
                  className="grid min-h-11 cursor-default grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-3 text-sm font-bold outline-none transition hover:bg-slate-100 data-[highlighted]:bg-slate-100 data-[selected]:text-slate-950 dark:hover:bg-slate-800 dark:data-[highlighted]:bg-slate-800 dark:data-[selected]:text-white"
                  value={option.value}
                  label={option.label}
                  onClick={() => onChange(option.value)}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="text-slate-950 dark:text-white">
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Root>
    </div>
  );
}

function UnitMultiSelect({ units, selectedUnitIdxs, onChange }) {
  const safeSelectedUnitIdxs = Array.isArray(selectedUnitIdxs) ? selectedUnitIdxs : [];
  const selectedSet = new Set(safeSelectedUnitIdxs.map((unitIdx) => Number(unitIdx)));

  function toggleUnit(unitIdx) {
    if (selectedSet.has(unitIdx)) {
      const nextUnitIdxs = safeSelectedUnitIdxs.filter((value) => Number(value) !== unitIdx);
      if (nextUnitIdxs.length > 0) onChange(nextUnitIdxs);
      return;
    }

    onChange([...safeSelectedUnitIdxs, unitIdx]);
  }

  return (
    <section className="grid gap-2">
      <span className="px-1 text-sm font-bold text-slate-700 dark:text-slate-200">Units</span>
      <div className="grid grid-cols-2 gap-2">
        {units.map((unit) => {
          const selected = selectedSet.has(unit.idx);
          return (
            <button
              key={unit.idx}
              className={`flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-2xl border px-3 text-left text-base font-bold shadow-sm shadow-slate-900/4 transition focus:outline-none ${
                selected
                  ? "border-sky-300/70 bg-sky-400 text-white shadow-sky-900/12 hover:bg-sky-300 dark:border-sky-300/45 dark:bg-sky-400 dark:text-white dark:hover:bg-sky-300"
                  : "border-white/32 bg-white/42 text-slate-700 hover:bg-white/64 dark:border-white/10 dark:bg-slate-900/52 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleUnit(unit.idx)}
            >
              <span className="min-w-0 truncate">{getDisplayName(unit)}</span>
              {selected ? <Check className="size-4 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function createDraft(unitIdx, mode, fan) {
  return {
    name: "",
    unitIdxs: [unitIdx],
    time: "08:00",
    days: weekdays.map((day) => day.value),
    mode,
    fan,
    tempSet: 24
  };
}

function toDraft(automation) {
  return {
    name: automation.name,
    unitIdxs: automation.unitIdxs || [automation.unitIdx],
    time: automation.time,
    days: automation.days,
    mode: automation.mode,
    fan: automation.fan,
    tempSet: automation.tempSet
  };
}

function normalizeDraftOptions(draft, units, modes, fans, unitIdx, mode, fan) {
  const currentUnitIdxs = Array.isArray(draft.unitIdxs) ? draft.unitIdxs : [draft.unitIdx];
  const validUnitIdxs = currentUnitIdxs.filter((selectedUnitIdx) =>
    units.some((unit) => unit.idx === Number(selectedUnitIdx))
  );

  return {
    ...draft,
    unitIdxs: validUnitIdxs.length > 0 ? validUnitIdxs : [unitIdx],
    mode: modes.some((option) => option.value === Number(draft.mode)) ? draft.mode : mode,
    fan: fans.some((option) => option.value === Number(draft.fan)) ? draft.fan : fan
  };
}

function toPayload(draft) {
  const unitIdxs = Array.isArray(draft.unitIdxs) ? draft.unitIdxs : [draft.unitIdx];

  return {
    ...draft,
    unitIdxs: unitIdxs.map((unitIdx) => Number(unitIdx)),
    mode: Number(draft.mode),
    fan: Number(draft.fan),
    tempSet: Number(draft.tempSet)
  };
}

function toggleDay(days, day) {
  if (days.includes(day)) {
    const nextDays = days.filter((value) => value !== day);
    return nextDays.length > 0 ? nextDays : days;
  }

  return [...days, day];
}

function findLabel(options, value) {
  return options.find((option) => option.value === Number(value))?.label || value;
}

function formatDays(days) {
  if (days.length === weekdays.length) return "Every day";
  return weekdays.filter((day) => days.includes(day.value)).map((day) => day.label).join("");
}

function formatUnitNames(unitIdxs, unitsByIdx) {
  const names = unitIdxs.map((unitIdx) => {
    const unit = unitsByIdx.get(Number(unitIdx));
    return unit ? getDisplayName(unit) : null;
  }).filter(Boolean);

  if (names.length === 0) return "Missing unit";
  return names.join(", ");
}
