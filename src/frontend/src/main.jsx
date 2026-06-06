import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Edit3, Minus, Plus, Power, RefreshCw, X } from "lucide-react";
import "./styles.css";

const flow1Options = [
  { value: 0, label: "保持" },
  { value: 1, label: "位置 1" },
  { value: 2, label: "位置 2" },
  { value: 3, label: "位置 3" },
  { value: 4, label: "位置 4" },
  { value: 5, label: "位置 5" },
  { value: 6, label: "位置 6" },
  { value: 7, label: "位置 7" }
];

const flow2Options = [
  { value: 0, label: "保持" },
  { value: 1, label: "位置 1" },
  { value: 2, label: "位置 2" },
  { value: 3, label: "位置 3" },
  { value: 4, label: "位置 4" },
  { value: 5, label: "位置 5" },
  { value: 6, label: "位置 6" }
];

function App() {
  const [units, setUnits] = useState([]);
  const [modes, setModes] = useState([]);
  const [fans, setFans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [panelBusy, setPanelBusy] = useState(false);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.idx === selectedIdx) || null,
    [selectedIdx, units]
  );

  useEffect(() => {
    async function boot() {
      try {
        const options = await api("/api/options");
        setModes(options.modes);
        setFans(options.fans);
        await loadUnits();
      } catch (error) {
        setMessage(error.message);
      }
    }

    boot();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setSelectedIdx(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function loadUnits() {
    setLoading(true);
    try {
      const payload = await api("/api/units");
      setUnits(payload.units);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateSelected(patch) {
    if (!selectedUnit || panelBusy) return;
    setPanelBusy(true);
    try {
      await api(`/api/units/${selectedUnit.idx}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      await loadUnits();
    } catch (error) {
      setMessage(error.message);
      await loadUnits();
    } finally {
      setPanelBusy(false);
    }
  }

  async function saveAlias(alias) {
    if (!selectedUnit) return;
    setPanelBusy(true);
    try {
      await api(`/api/units/${selectedUnit.idx}/alias`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alias })
      });
      await loadUnits();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setPanelBusy(false);
    }
  }

  return (
    <main className="relative z-10 mx-auto min-h-dvh w-full max-w-5xl px-4 pb-8 pt-[max(22px,env(safe-area-inset-top))] sm:px-6">
      <header className="flex min-h-24 items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70">Home Climate</p>
          <h1 className="mt-1 text-4xl font-bold leading-none text-slate-950 sm:text-6xl">中央空调</h1>
        </div>
        <button
          className="grid size-12 place-items-center rounded-2xl border border-white/70 bg-white/55 text-slate-950 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition hover:bg-white/70 disabled:opacity-50"
          type="button"
          onClick={loadUnits}
          disabled={loading}
          aria-label="刷新"
        >
          <RefreshCw className={loading ? "size-5 animate-spin" : "size-5"} />
        </button>
      </header>

      {message ? (
        <section className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
          {message}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-4" aria-live="polite">
        {units.length === 0 && !loading ? (
          <p className="col-span-full rounded-2xl border border-white/70 bg-white/55 px-4 py-3 text-slate-600 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
            没有读取到空调
          </p>
        ) : null}
        {units.map((unit) => (
          <UnitCard key={unit.idx} unit={unit} onOpen={() => setSelectedIdx(unit.idx)} />
        ))}
      </section>

      <DetailPanel
        unit={selectedUnit}
        modes={modes}
        fans={fans}
        busy={panelBusy}
        onClose={() => setSelectedIdx(null)}
        onSaveAlias={saveAlias}
        onUpdate={updateSelected}
      />
    </main>
  );
}

function UnitCard({ unit, onOpen }) {
  const state = getCardState(unit);
  const stateName = getStateName(unit);

  return (
    <button
      className={cardClassName(state)}
      type="button"
      onClick={onOpen}
    >
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
        <span className="text-sm font-medium text-slate-600/75">当前温度</span>
      </span>
      <span className="relative truncate text-left text-sm text-slate-600/75">
        {unit.on === 1 ? `设定 ${unit.tempSet}° · ${unit.modeLabel} · ${unit.fanLabel}` : "轻点查看"}
      </span>
    </button>
  );
}

function DetailPanel({ unit, modes, fans, busy, onClose, onSaveAlias, onUpdate }) {
  const [editingAlias, setEditingAlias] = useState(false);
  const [alias, setAlias] = useState("");

  useEffect(() => {
    setEditingAlias(false);
    setAlias(unit?.alias || "");
  }, [unit?.idx]);

  if (!unit) return null;

  const disabled = busy;
  const minTemp = unit.lowestVal || 16;
  const maxTemp = unit.highestVal || 32;

  async function submitAlias(event) {
    event.preventDefault();
    await onSaveAlias(alias.trim());
    setEditingAlias(false);
  }

  return (
    <>
      <button
        className="fixed inset-0 z-20 bg-slate-900/25 backdrop-blur-sm"
        type="button"
        aria-label="关闭控制面板"
        onClick={onClose}
      />
      <aside
        className="fixed bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 z-30 max-h-[calc(100dvh-24px)] w-[min(520px,calc(100%-28px))] -translate-x-1/2 overflow-auto rounded-[28px] border border-white/75 bg-white/75 px-4 pb-4 pt-2 text-slate-950 shadow-2xl shadow-slate-900/25 backdrop-blur-2xl transition sm:px-5"
        aria-modal="true"
        role="dialog"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-900/20" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70">Air Conditioner</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="overflow-wrap-anywhere text-3xl font-bold leading-tight">{getDisplayName(unit)}</h2>
              <button
                className="grid size-8 place-items-center rounded-full bg-white/55 text-slate-700 transition hover:bg-white/75 disabled:opacity-50"
                type="button"
                onClick={() => setEditingAlias((value) => !value)}
                disabled={disabled}
                aria-label="编辑昵称"
              >
                <Edit3 className="size-4" />
              </button>
            </div>
          </div>
          <button
            className="grid size-11 place-items-center rounded-2xl border border-white/70 bg-white/55 text-slate-950 shadow-lg shadow-slate-900/10 transition hover:bg-white/75"
            type="button"
            onClick={onClose}
            aria-label="关闭"
          >
            <X className="size-5" />
          </button>
        </div>

        {editingAlias ? (
          <form className="mt-4 grid grid-cols-[1fr_auto] gap-2" onSubmit={submitAlias}>
            <input
              className="min-h-11 min-w-0 rounded-2xl border border-white/80 bg-white/55 px-3 text-slate-950 outline-none ring-teal-600/20 transition focus:ring-4"
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              maxLength={18}
              autoComplete="off"
              placeholder="空调昵称"
              disabled={disabled}
            />
            <button
              className="min-h-11 rounded-2xl border border-white/80 bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
              type="submit"
              disabled={disabled}
            >
              保存
            </button>
          </form>
        ) : null}

        <section className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <StatusItem label="状态" value={getStateName(unit)} />
          <StatusItem label="当前温度" value={`${unit.tempIn}°`} />
          <StatusItem label="设定温度" value={`${unit.tempSet}°`} />
        </section>

        <section className="mt-4 grid grid-cols-[56px_1fr_56px] items-center gap-3 rounded-3xl bg-white/45 p-4">
          <StepButton
            label="降低温度"
            icon={<Minus className="size-5" />}
            disabled={disabled || unit.tempSet <= minTemp}
            onClick={() => onUpdate({ tempSet: Math.max(minTemp, unit.tempSet - 1) })}
          />
          <div className="grid justify-items-center gap-1">
            <strong className="text-6xl font-bold leading-none">{unit.tempSet}°</strong>
            <span className="text-sm font-semibold text-slate-600/75">目标温度</span>
          </div>
          <StepButton
            label="升高温度"
            icon={<Plus className="size-5" />}
            disabled={disabled || unit.tempSet >= maxTemp}
            onClick={() => onUpdate({ tempSet: Math.min(maxTemp, unit.tempSet + 1) })}
          />
        </section>

        <section className="mt-4 grid gap-2">
          <PowerRow
            checked={unit.on === 1}
            disabled={disabled}
            onChange={(checked) => onUpdate({ on: checked ? 1 : 0 })}
          />
          <SelectRow label="模式" value={unit.mode} options={modes} disabled={disabled} onChange={(value) => onUpdate({ mode: value })} />
          <SelectRow label="风速" value={unit.fan} options={fans} disabled={disabled} onChange={(value) => onUpdate({ fan: value })} />
          <SelectRow label="上下摆风" value={unit.FlowDirection1} options={flow1Options} disabled={disabled} onChange={(value) => onUpdate({ FlowDirection1: value })} />
          <SelectRow label="左右摆风" value={unit.FlowDirection2} options={flow2Options} disabled={disabled} onChange={(value) => onUpdate({ FlowDirection2: value })} />
        </section>

        <section className="mt-4 flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3">
          <span className="text-sm font-semibold text-slate-600/75">定时</span>
          <strong className="text-sm font-bold text-slate-500">稍后添加</strong>
        </section>
      </aside>
    </>
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
        开关
      </span>
      <input
        className="peer sr-only"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={`relative h-8 w-14 rounded-full transition ${checked ? "bg-teal-700" : "bg-slate-900/25"} ${disabled ? "opacity-50" : ""}`}>
        <span className={`absolute left-1 top-1 size-6 rounded-full bg-white shadow-md shadow-slate-900/20 transition ${checked ? "translate-x-6" : ""}`} />
      </span>
    </label>
  );
}

function SelectRow({ label, value, options, disabled, onChange }) {
  return (
    <label className="grid min-h-14 grid-cols-1 items-center gap-2 rounded-2xl bg-white/45 px-4 py-3 sm:grid-cols-[1fr_minmax(132px,auto)]">
      <span className="text-sm font-semibold text-slate-600/75">{label}</span>
      <select
        className="min-h-11 w-full rounded-2xl border border-white/80 bg-white/55 px-3 text-slate-950 outline-none ring-teal-600/20 transition focus:ring-4 disabled:opacity-50"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function getCardState(unit) {
  if (unit.alarm !== 0) return "warning";
  if (unit.on === 1) return "running";
  return "off";
}

function getStateName(unit) {
  if (unit.alarm !== 0) return "需要检查";
  if (unit.on === 1) return "运行中";
  return "已关闭";
}

function getDisplayName(unit) {
  return unit.alias || `空调 ${unit.idx + 1}`;
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

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败 ${response.status}`);
  return payload;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
