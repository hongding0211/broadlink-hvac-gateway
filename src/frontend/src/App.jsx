import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DetailPanel } from "./components/DetailPanel.jsx";
import { UnitCard } from "./components/UnitCard.jsx";
import { api } from "./lib/hvac.js";

export function App() {
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
          <h1 className="mt-1 text-4xl font-bold leading-none text-slate-950 sm:text-6xl">HVAC Control</h1>
        </div>
        <button
          className="grid size-12 place-items-center rounded-2xl border border-white/70 bg-white/55 text-slate-950 shadow-lg shadow-slate-900/10 backdrop-blur-xl transition hover:bg-white/70 disabled:opacity-50"
          type="button"
          onClick={loadUnits}
          disabled={loading}
          aria-label="Refresh"
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
            No HVAC units found
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
