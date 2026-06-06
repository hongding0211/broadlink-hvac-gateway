const state = {
  units: [],
  modes: [],
  fans: [],
  loading: false,
  selectedUnit: null
};

const els = {
  units: document.querySelector("#units"),
  message: document.querySelector("#message"),
  refreshButton: document.querySelector("#refreshButton"),
  template: document.querySelector("#unitTemplate"),
  panelBackdrop: document.querySelector("#panelBackdrop"),
  detailPanel: document.querySelector("#detailPanel"),
  closePanel: document.querySelector("#closePanel"),
  panelTitle: document.querySelector("#panelTitle"),
  panelState: document.querySelector("#panelState"),
  panelMeta: document.querySelector("#panelMeta")
};

els.refreshButton.addEventListener("click", () => loadUnits());
els.closePanel.addEventListener("click", closePanel);
els.panelBackdrop.addEventListener("click", closePanel);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePanel();
});

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
  els.units.replaceChildren();

  if (state.units.length === 0) {
    const empty = document.createElement("p");
    empty.className = "message";
    empty.textContent = "没有读取到空调";
    els.units.append(empty);
    return;
  }

  for (const unit of state.units) {
    els.units.append(renderUnit(unit));
  }
}

function renderUnit(unit) {
  const node = els.template.content.firstElementChild.cloneNode(true);
  const displayName = `空调 ${unit.idx + 1}`;
  const stateName = getStateName(unit);

  node.dataset.idx = unit.idx;
  node.dataset.state = getCardState(unit);
  node.querySelector("h2").textContent = displayName;
  node.querySelector(".state").textContent = stateName;
  node.querySelector(".room-temp").textContent = `${unit.tempIn}°`;
  node.querySelector(".temperature small").textContent = "当前温度";
  node.querySelector(".detail").textContent =
    unit.on === 1 ? `设定 ${unit.tempSet}° · ${unit.modeLabel} · ${unit.fanLabel}` : "轻点查看";
  node.addEventListener("click", () => openPanel(unit, displayName, stateName));

  return node;
}

function openPanel(unit, displayName, stateName) {
  state.selectedUnit = unit;
  els.panelTitle.textContent = displayName;
  els.panelState.textContent = stateName;
  els.panelMeta.textContent =
    unit.alarm !== 0
      ? `告警代码 ${unit.alarm}`
      : `当前 ${unit.tempIn}°，设定 ${unit.tempSet}°，${unit.modeLabel}，${unit.fanLabel}`;
  els.panelBackdrop.classList.remove("hidden");
  els.detailPanel.classList.remove("hidden");
}

function closePanel() {
  state.selectedUnit = null;
  els.panelBackdrop.classList.add("hidden");
  els.detailPanel.classList.add("hidden");
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
