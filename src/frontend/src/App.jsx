import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DetailPanel } from "./components/DetailPanel.jsx";
import { UnitCard } from "./components/UnitCard.jsx";
import { api } from "./lib/hvac.js";

export function App() {
  const [units, setUnits] = useState([]);
  const [modes, setModes] = useState([]);
  const [fans, setFans] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [syncingUnits, setSyncingUnits] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [aliasBusy, setAliasBusy] = useState(false);
  const desiredPatchesRef = useRef(new Map());
  const inFlightUnitsRef = useRef(new Set());

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

  return (
    <main className="relative z-10 mx-auto min-h-dvh w-full max-w-5xl px-4 pb-8 pt-[max(22px,env(safe-area-inset-top))] sm:px-6">
      <header className="flex min-h-24 items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-600/70 dark:text-slate-200/75">MUCAA</p>
          <h1 className="mt-1 text-4xl font-bold leading-none text-slate-950 dark:text-white sm:text-6xl">Home climate</h1>
        </div>
        <button
          className="grid size-12 place-items-center rounded-full bg-white/12 text-slate-950 shadow-sm shadow-slate-900/5 backdrop-blur-xl transition hover:bg-white/20 focus:outline-none disabled:opacity-50 dark:bg-slate-950/42 dark:text-white dark:shadow-black/25 dark:hover:bg-slate-950/56"
          type="button"
          onClick={() => loadUnits()}
          disabled={loadingUnits}
          aria-label="Refresh"
        >
          <RefreshCw className={loadingUnits || syncingUnits > 0 ? "size-5 animate-spin" : "size-5"} />
        </button>
      </header>

      {message ? (
        <section className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm font-medium text-amber-800 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
          {message}
        </section>
      ) : null}

      <section className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 lg:grid-cols-4" aria-live="polite" aria-busy={loadingUnits || syncingUnits > 0}>
        {!loadingUnits && units.length === 0 ? (
          <p className="col-span-full rounded-2xl bg-white/18 px-4 py-3 text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur-xl dark:border dark:border-white/15 dark:bg-slate-950/35 dark:text-slate-200 dark:shadow-black/25">
            No HVAC units found
          </p>
        ) : null}
        {!loadingUnits
          ? units.map((unit) => (
              <UnitCard key={unit.idx} unit={unit} onOpen={() => setSelectedIdx(unit.idx)} />
            ))
          : null}
      </section>

      <DetailPanel
        unit={selectedUnit}
        modes={modes}
        fans={fans}
        busy={aliasBusy}
        onClose={() => setSelectedIdx(null)}
        onSaveAlias={saveAlias}
        onUpdate={updateSelected}
      />
    </main>
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
