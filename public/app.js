const state = {
  units: [],
  modes: [],
  fans: [],
  filter: "all",
  loading: false
};

const els = {
  summary: document.querySelector("#summary"),
  unitCount: document.querySelector("#unitCount"),
  runningCount: document.querySelector("#runningCount"),
  alarmCount: document.querySelector("#alarmCount"),
  units: document.querySelector("#units"),
  message: document.querySelector("#message"),
  refreshButton: document.querySelector("#refreshButton"),
  filterButtons: [...document.querySelectorAll("[data-filter]")],
  template: document.querySelector("#unitTemplate")
};

els.refreshButton.addEventListener("click", () => loadUnits());
for (const button of els.filterButtons) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    for (const item of els.filterButtons) item.classList.toggle("active", item === button);
    render();
  });
}

await boot();

async function boot() {
  try {
    const options = await api("/api/options");
    state.modes = options.modes;
    state.fans = options.fans;
    await loadUnits();
  } catch (error) {
    showMessage(error.message);
  }
}

async function loadUnits() {
  setLoading(true);
  try {
    const payload = await api("/api/units");
    state.units = payload.units;
    hideMessage();
    render();
  } catch (error) {
    showMessage(error.message);
  } finally {
    setLoading(false);
  }
}

function render() {
  const running = state.units.filter((unit) => unit.on === 1).length;
  const alarms = state.units.filter((unit) => unit.alarm !== 0).length;
  els.unitCount.textContent = String(state.units.length);
  els.runningCount.textContent = String(running);
  els.alarmCount.textContent = String(alarms);
  els.summary.textContent = state.units.length
    ? `已同步 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
    : "没有读取到内机";

  els.units.replaceChildren();
  const units = filteredUnits();

  if (units.length === 0) {
    const empty = document.createElement("p");
    empty.className = "message";
    empty.textContent = "当前筛选下没有内机";
    els.units.append(empty);
    return;
  }

  for (const unit of units) {
    els.units.append(renderUnit(unit));
  }
}

function renderUnit(unit) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  node.dataset.idx = unit.idx;
  node.querySelector("h2").textContent = unit.name;
  node.querySelector(".meta").textContent = `地址 ${unit.address} · ID ${unit.idx}`;
  node.querySelector(".set-temp").textContent = `${unit.tempSet}°`;
  node.querySelector(".room-temp").textContent = `${unit.tempIn}°`;

  const alarm = node.querySelector(".alarm");
  alarm.textContent = unit.alarm === 0 ? "正常" : `告警 ${unit.alarm}`;
  alarm.dataset.state = unit.alarm === 0 ? "ok" : "bad";

  const power = node.querySelector(".power");
  power.checked = unit.on === 1;
  power.addEventListener("change", () => patchUnit(unit.idx, { on: power.checked ? 1 : 0 }, node));

  node.querySelector(".temp-down").addEventListener("click", () => {
    patchUnit(unit.idx, { tempSet: Math.max(16, unit.tempSet - 1) }, node);
  });
  node.querySelector(".temp-up").addEventListener("click", () => {
    patchUnit(unit.idx, { tempSet: Math.min(32, unit.tempSet + 1) }, node);
  });

  const mode = node.querySelector(".mode");
  fillSelect(mode, state.modes, unit.mode);
  mode.addEventListener("change", () => patchUnit(unit.idx, { mode: Number(mode.value) }, node));

  const fan = node.querySelector(".fan");
  fillSelect(fan, state.fans, unit.fan);
  fan.addEventListener("change", () => patchUnit(unit.idx, { fan: Number(fan.value) }, node));

  return node;
}

async function patchUnit(idx, patch, node) {
  node.dataset.busy = "true";
  try {
    await api(`/api/units/${idx}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch)
    });
    await loadUnits();
  } catch (error) {
    showMessage(error.message);
    await loadUnits();
  } finally {
    delete node.dataset.busy;
  }
}

function filteredUnits() {
  if (state.filter === "on") return state.units.filter((unit) => unit.on === 1);
  if (state.filter === "off") return state.units.filter((unit) => unit.on === 0);
  return state.units;
}

function fillSelect(select, options, value) {
  select.replaceChildren(
    ...options.map((option) => {
      const item = document.createElement("option");
      item.value = String(option.value);
      item.textContent = option.label;
      item.selected = option.value === value;
      return item;
    })
  );
}

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败 ${response.status}`);
  return payload;
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.refreshButton.disabled = isLoading;
  els.refreshButton.style.opacity = isLoading ? "0.5" : "1";
}

function showMessage(message) {
  els.message.textContent = message;
  els.message.classList.remove("hidden");
}

function hideMessage() {
  els.message.textContent = "";
  els.message.classList.add("hidden");
}
