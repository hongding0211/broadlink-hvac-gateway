import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, House, RefreshCw } from "lucide-react";
import { AutomationTab } from "./components/AutomationTab.jsx";
import { DetailPanel } from "./components/DetailPanel.jsx";
import { UnitCard } from "./components/UnitCard.jsx";
import { api } from "./lib/hvac.js";

const unitPollIntervalMs = 2000;
const optimisticHoldMs = 10000;

export function App() {
  const [units, setUnits] = useState([]);
  const [modes, setModes] = useState([]);
  const [fans, setFans] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [syncingUnits, setSyncingUnits] = useState(0);
  const [unitTimers, setUnitTimers] = useState([]);
  const [unitPreferences, setUnitPreferences] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [aliasBusy, setAliasBusy] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [reorderMode, setReorderMode] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const desiredPatchesRef = useRef(new Map());
  const inFlightUnitsRef = useRef(new Set());
  const optimisticUntilRef = useRef(new Map());
  const pollingUnitsRef = useRef(false);
  const unitsRef = useRef([]);
  const reorderModeRef = useRef(false);
  const draggingIdxRef = useRef(null);
  const reorderDirtyRef = useRef(false);
  const longPressRef = useRef(null);

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.idx === selectedIdx) || null,
    [selectedIdx, units]
  );
  const unitTimersByIdx = useMemo(() => {
    const timersByIdx = new Map();
    for (const timer of unitTimers) {
      const timers = timersByIdx.get(timer.unitIdx) || [];
      timers.push(timer);
      timersByIdx.set(timer.unitIdx, timers);
    }
    for (const timers of timersByIdx.values()) {
      timers.sort((left, right) => left.runAt.localeCompare(right.runAt));
    }
    return timersByIdx;
  }, [unitTimers]);
  const unitPreferencesByIdx = useMemo(
    () => new Map(unitPreferences.map((preference) => [preference.unitIdx, preference.patch || {}])),
    [unitPreferences]
  );

  useEffect(() => {
    async function boot() {
      try {
        const options = await api("/api/options");
        setModes(options.modes);
        setFans(options.fans);
        await Promise.all([loadUnits(), loadUnitTimers(), loadUnitPreferences()]);
      } catch (error) {
        setMessage(error.message);
      }
    }

    boot();
  }, []);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  useEffect(() => {
    reorderModeRef.current = reorderMode;
  }, [reorderMode]);

  useEffect(() => {
    return () => {
      clearLongPress();
      window.removeEventListener("pointermove", handleUnitPointerMove);
      window.removeEventListener("pointerup", handleUnitPointerUp);
      window.removeEventListener("pointercancel", handleUnitPointerUp);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setSelectedIdx(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let timerId = null;
    let cancelled = false;

    function stopPolling() {
      if (!timerId) return;
      window.clearInterval(timerId);
      timerId = null;
    }

    function startPolling() {
      if (timerId || document.visibilityState !== "visible") return;
      timerId = window.setInterval(() => {
        void pollUnits();
      }, unitPollIntervalMs);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void pollUnits();
        startPolling();
      } else {
        stopPolling();
      }
    }

    async function pollUnits() {
      if (cancelled || document.visibilityState !== "visible" || pollingUnitsRef.current) return;
      pollingUnitsRef.current = true;

      try {
        const payload = await api("/api/units");
        const timerPayload = await api("/api/unit-timers");
        const preferencePayload = await api("/api/unit-preferences");
        if (!reorderModeRef.current) {
          setUnits((currentUnits) =>
            mergePolledUnits(
              currentUnits,
              payload.units,
              desiredPatchesRef.current,
              inFlightUnitsRef.current,
              optimisticUntilRef.current,
              Date.now()
            )
          );
        }
        setUnitTimers(timerPayload.timers);
        setUnitPreferences(preferencePayload.preferences);
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      } finally {
        pollingUnitsRef.current = false;
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    startPolling();

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  async function loadUnits({ hideContent = true } = {}) {
    if (hideContent) {
      setLoadingUnits(true);
    } else {
      setSyncingUnits((count) => count + 1);
    }

    try {
      const payload = await api("/api/units");
      setUnits(payload.units);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      if (hideContent) {
        setLoadingUnits(false);
      } else {
        setSyncingUnits((count) => Math.max(0, count - 1));
      }
    }
  }

  async function loadUnitTimers() {
    try {
      const payload = await api("/api/unit-timers");
      setUnitTimers(payload.timers);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadUnitPreferences() {
    try {
      const payload = await api("/api/unit-preferences");
      setUnitPreferences(payload.preferences);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function applyUnitPatch(idx, patch) {
    const enrichedPatch = enrichUnitPatch(patch);
    setUnits((currentUnits) =>
      currentUnits.map((unit) => (unit.idx === idx ? { ...unit, ...enrichedPatch } : unit))
    );
  }

  function enrichUnitPatch(patch) {
    const enrichedPatch = { ...patch };

    if (Object.hasOwn(patch, "mode")) {
      const option = modes.find((item) => item.value === Number(patch.mode));
      enrichedPatch.modeLabel = option?.label || `Mode ${patch.mode}`;
    }

    if (Object.hasOwn(patch, "fan")) {
      const option = fans.find((item) => item.value === Number(patch.fan));
      enrichedPatch.fanLabel = option?.label || `Fan ${patch.fan}`;
    }

    return enrichedPatch;
  }

  function updateSelected(patch) {
    if (!selectedUnit) return;
    if (selectedUnit.on !== 1 && !Object.hasOwn(patch, "on")) return;

    const idx = selectedUnit.idx;
    const currentDesiredPatch = desiredPatchesRef.current.get(idx) || {};
    desiredPatchesRef.current.set(idx, { ...currentDesiredPatch, ...patch });
    optimisticUntilRef.current.set(idx, Date.now() + optimisticHoldMs);
    applyUnitPatch(idx, patch);
    setMessage("");
    void flushUnitUpdate(idx);
  }

  async function flushUnitUpdate(idx) {
    if (inFlightUnitsRef.current.has(idx)) return;

    const desiredPatch = desiredPatchesRef.current.get(idx);
    if (!desiredPatch) return;

    const sentPatch = { ...desiredPatch };
    inFlightUnitsRef.current.add(idx);
    setSyncingUnits((count) => count + 1);

    try {
      const payload = await api(`/api/units/${idx}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sentPatch)
      });

      const latestDesiredPatch = desiredPatchesRef.current.get(idx);
      if (patchesEqual(latestDesiredPatch, sentPatch)) {
        desiredPatchesRef.current.delete(idx);
        if (payload.unit) applyUnitPatch(idx, payload.unit);
        setMessage("");
      }
    } catch (error) {
      const latestDesiredPatch = desiredPatchesRef.current.get(idx);
      if (patchesEqual(latestDesiredPatch, sentPatch)) {
        desiredPatchesRef.current.delete(idx);
        optimisticUntilRef.current.delete(idx);
        setMessage(error.message);
        await loadUnits({ hideContent: false });
      }
    } finally {
      inFlightUnitsRef.current.delete(idx);
      setSyncingUnits((count) => Math.max(0, count - 1));
      if (desiredPatchesRef.current.has(idx)) void flushUnitUpdate(idx);
    }
  }

  async function saveAlias(alias) {
    if (!selectedUnit) return;
    setAliasBusy(true);
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
      setAliasBusy(false);
    }
  }

  async function saveUnitTimer(unitIdx, action, localValue, presetMinutes = null, patch = undefined) {
    const runAt = new Date(localValue);
    if (Number.isNaN(runAt.getTime())) {
      setMessage("Timer time is invalid");
      return;
    }

    try {
      const body = { runAt: runAt.toISOString(), presetMinutes };
      if (patch) body.patch = patch;
      const payload = await api(`/api/units/${unitIdx}/timers/${action}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      setUnitTimers((currentTimers) => [
        ...currentTimers.filter((timer) => timer.unitIdx !== unitIdx || timer.action !== action),
        payload.timer
      ]);
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateUnitPreference(unitIdx, patch) {
    const currentPreference = unitPreferencesByIdx.get(unitIdx) || {};
    const nextPatch = { ...currentPreference, ...patch };
    setUnitPreferences((currentPreferences) => upsertPreference(currentPreferences, unitIdx, nextPatch));

    try {
      const payload = await api(`/api/units/${unitIdx}/preferences`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch)
      });
      setUnitPreferences((currentPreferences) => upsertPreference(currentPreferences, unitIdx, payload.preference.patch));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      await loadUnitPreferences();
    }
  }

  async function updateUnitTimerPatch(unitIdx, patch) {
    const timer = unitTimers.find((item) => item.unitIdx === unitIdx && item.action === "on");
    if (!timer) return;

    const nextPatch = { ...(timer.patch || {}), ...patch, on: 1 };
    setUnitTimers((currentTimers) =>
      currentTimers.map((item) => (item.unitIdx === unitIdx && item.action === "on" ? { ...item, patch: nextPatch } : item))
    );

    try {
      const payload = await api(`/api/units/${unitIdx}/timers/on`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          runAt: timer.runAt,
          presetMinutes: timer.presetMinutes,
          patch: nextPatch
        })
      });
      setUnitTimers((currentTimers) =>
        currentTimers.map((item) => (item.unitIdx === unitIdx && item.action === "on" ? payload.timer : item))
      );
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      await loadUnitTimers();
    }
  }

  async function deleteUnitTimer(unitIdx, action) {
    try {
      await api(`/api/units/${unitIdx}/timers/${action}`, { method: "DELETE" });
      setUnitTimers((currentTimers) =>
        currentTimers.filter((timer) => timer.unitIdx !== unitIdx || timer.action !== action)
      );
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function handleUnitPointerDown(event, unitIdx) {
    if (activeTab !== "home" || loadingUnits) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const startX = event.clientX;
    const startY = event.clientY;

    clearLongPress();
    window.removeEventListener("pointerup", clearLongPress);
    window.removeEventListener("pointercancel", clearLongPress);

    if (reorderModeRef.current) {
      event.preventDefault();
      beginDrag(unitIdx);
      return;
    }

    longPressRef.current = {
      timerId: window.setTimeout(() => {
        longPressRef.current = null;
        setReorderMode(true);
        beginDrag(unitIdx);
      }, 520),
      startX,
      startY
    };

    window.addEventListener("pointerup", clearLongPress, { once: true });
    window.addEventListener("pointercancel", clearLongPress, { once: true });
  }

  function handleUnitPointerMove(event) {
    if (longPressRef.current && Math.hypot(event.clientX - longPressRef.current.startX, event.clientY - longPressRef.current.startY) > 10) {
      clearLongPress();
    }

    const unitIdx = draggingIdxRef.current;
    if (unitIdx === null) return;

    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-unit-card-idx]");
    const targetIdx = Number(target?.dataset?.unitCardIdx);
    if (!Number.isInteger(targetIdx) || targetIdx === unitIdx) return;

    setUnits((currentUnits) => {
      const nextUnits = moveUnit(currentUnits, unitIdx, targetIdx);
      unitsRef.current = nextUnits;
      return nextUnits;
    });
    reorderDirtyRef.current = true;
  }

  function handleUnitPointerUp() {
    clearLongPress();
    if (draggingIdxRef.current === null) return;

    draggingIdxRef.current = null;
    setDraggingIdx(null);
    window.removeEventListener("pointermove", handleUnitPointerMove);
    window.removeEventListener("pointerup", handleUnitPointerUp);
    window.removeEventListener("pointercancel", handleUnitPointerUp);

    if (reorderDirtyRef.current) {
      reorderDirtyRef.current = false;
      void saveUnitOrder(unitsRef.current.map((unit) => unit.idx));
    }
  }

  function beginDrag(unitIdx) {
    draggingIdxRef.current = unitIdx;
    reorderDirtyRef.current = false;
    setDraggingIdx(unitIdx);
    window.addEventListener("pointermove", handleUnitPointerMove, { passive: false });
    window.addEventListener("pointerup", handleUnitPointerUp);
    window.addEventListener("pointercancel", handleUnitPointerUp);
  }

  function clearLongPress() {
    if (!longPressRef.current) return;
    window.clearTimeout(longPressRef.current.timerId);
    longPressRef.current = null;
    window.removeEventListener("pointerup", clearLongPress);
    window.removeEventListener("pointercancel", clearLongPress);
  }

  async function saveUnitOrder(order) {
    try {
      await api("/api/unit-order", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order })
      });
      setMessage("");
    } catch (error) {
      setMessage(error.message);
      await loadUnits({ hideContent: false });
    }
  }

  return (
    <main className="relative z-10 mx-auto h-[var(--app-height,100dvh)] w-full max-w-5xl overflow-y-auto overscroll-contain px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))] [touch-action:pan-y] [-webkit-overflow-scrolling:touch] sm:px-6">
      <header className="flex min-h-24 items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70 dark:text-slate-200/75">MUCAA</p>
          <h1 className="mt-1 text-4xl font-bold leading-none text-slate-950 dark:text-white sm:text-6xl">
            {activeTab === "home" ? "Home climate" : "Automation"}
          </h1>
        </div>
        {activeTab === "home" ? (
          <button
            className="grid size-12 place-items-center rounded-full bg-white/12 text-slate-950 shadow-sm shadow-slate-900/5 backdrop-blur-xl transition hover:bg-white/20 focus:outline-none disabled:opacity-50 dark:bg-slate-950/42 dark:text-white dark:shadow-black/25 dark:hover:bg-slate-950/56"
            type="button"
            onClick={() => (reorderMode ? setReorderMode(false) : loadUnits({ hideContent: false }))}
            disabled={loadingUnits}
            aria-label={reorderMode ? "Done sorting" : "Refresh"}
          >
            {reorderMode ? <Check className="size-5" /> : <RefreshCw className={loadingUnits || syncingUnits > 0 ? "size-5 animate-spin" : "size-5"} />}
          </button>
        ) : null}
      </header>

      {message ? (
        <section className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
          {message}
        </section>
      ) : null}

      <section
        className={`grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-4 ${activeTab === "home" ? "" : "hidden"} ${reorderMode ? "touch-none" : ""}`}
        aria-live="polite"
        aria-busy={loadingUnits || syncingUnits > 0}
        aria-hidden={activeTab !== "home"}
      >
          {!loadingUnits && units.length === 0 ? (
            <p className="col-span-full rounded-2xl bg-white/18 px-4 py-3 text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border dark:border-white/15 dark:bg-slate-950/35 dark:text-slate-200 dark:shadow-black/25">
              No HVAC units found
            </p>
          ) : null}
          {!loadingUnits
            ? units.map((unit) => (
                <UnitCard
                  key={unit.idx}
                  unit={unit}
                  timers={unitTimersByIdx.get(unit.idx) || []}
                  reorderMode={reorderMode}
                  dragging={draggingIdx === unit.idx}
                  onPointerDown={(event) => handleUnitPointerDown(event, unit.idx)}
                  onOpen={() => setSelectedIdx(unit.idx)}
                />
              ))
            : null}
      </section>

      <section className={activeTab === "automation" ? "" : "hidden"} aria-hidden={activeTab !== "automation"}>
        <AutomationTab units={units} modes={modes} fans={fans} />
      </section>

      <DetailPanel
        unit={selectedUnit}
        modes={modes}
        fans={fans}
        busy={aliasBusy}
        onClose={() => setSelectedIdx(null)}
        onSaveAlias={saveAlias}
        preference={selectedUnit ? unitPreferencesByIdx.get(selectedUnit.idx) || {} : {}}
        timers={selectedUnit ? unitTimersByIdx.get(selectedUnit.idx) || [] : []}
        onSaveTimer={saveUnitTimer}
        onDeleteTimer={deleteUnitTimer}
        onUpdatePreference={updateUnitPreference}
        onUpdateTimerPatch={updateUnitTimerPatch}
        onUpdate={updateSelected}
      />

      <nav className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid h-16 max-w-sm grid-cols-2 gap-2 rounded-full border border-white/16 bg-white/24 p-2 shadow-xl shadow-slate-900/12 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/64 dark:shadow-black/35">
          <TabButton
            active={activeTab === "home"}
            icon={<House className="size-5" />}
            label="Home"
            onClick={() => setActiveTab("home")}
          />
          <TabButton
            active={activeTab === "automation"}
            icon={<CalendarClock className="size-5" />}
            label="Auto"
            onClick={() => setActiveTab("automation")}
          />
        </div>
      </nav>
    </main>
  );
}

function TabButton({ active, icon, label, onClick }) {
  return (
    <button
      className={`flex min-w-0 items-center justify-center gap-2 rounded-full border border-transparent text-sm font-bold transition focus:outline-none ${
        active
          ? "bg-white/42 text-slate-950 shadow-sm shadow-slate-900/8 backdrop-blur-3xl dark:bg-white/14 dark:text-white dark:shadow-black/20"
          : "text-slate-700 hover:bg-white/22 dark:text-slate-200 dark:hover:bg-white/8"
      }`}
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function patchesEqual(left, right) {
  if (!left || !right) return left === right;

  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if (Number(left[key]) !== Number(right[key])) return false;
  }

  return true;
}

function mergePolledUnits(currentUnits, polledUnits, desiredPatches, inFlightUnits, optimisticUntil, now) {
  const currentUnitsByIdx = new Map(currentUnits.map((unit) => [unit.idx, unit]));

  return polledUnits.map((polledUnit) => {
    const holdUntil = optimisticUntil.get(polledUnit.idx) || 0;
    if (holdUntil <= now) optimisticUntil.delete(polledUnit.idx);

    if (!desiredPatches.has(polledUnit.idx) && !inFlightUnits.has(polledUnit.idx) && holdUntil <= now) {
      return polledUnit;
    }

    return currentUnitsByIdx.get(polledUnit.idx) || polledUnit;
  });
}

function upsertPreference(preferences, unitIdx, patch) {
  const hasPreference = preferences.some((preference) => preference.unitIdx === unitIdx);
  if (!hasPreference) return [...preferences, { unitIdx, patch }];
  return preferences.map((preference) => (preference.unitIdx === unitIdx ? { unitIdx, patch } : preference));
}

function moveUnit(units, movingIdx, targetIdx) {
  const fromIndex = units.findIndex((unit) => unit.idx === movingIdx);
  const toIndex = units.findIndex((unit) => unit.idx === targetIdx);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return units;

  const nextUnits = [...units];
  const [movingUnit] = nextUnits.splice(fromIndex, 1);
  nextUnits.splice(toIndex, 0, movingUnit);
  return nextUnits;
}
