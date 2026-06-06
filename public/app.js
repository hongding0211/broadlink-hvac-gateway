const state = {
  units: [],
  modes: [],
  fans: [],
  loading: false,
  selectedUnit: null,
  panelBusy: false
};

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

const els = {
  units: document.querySelector("#units"),
  message: document.querySelector("#message"),
  refreshButton: document.querySelector("#refreshButton"),
  template: document.querySelector("#unitTemplate"),
  panelBackdrop: document.querySelector("#panelBackdrop"),
  detailPanel: document.querySelector("#detailPanel"),
  closePanel: document.querySelector("#closePanel"),
  editAlias: document.querySelector("#editAlias"),
  aliasForm: document.querySelector("#aliasForm"),
  aliasInput: document.querySelector("#aliasInput"),
  panelTitle: document.querySelector("#panelTitle"),
  panelState: document.querySelector("#panelState"),
  panelRoomTemp: document.querySelector("#panelRoomTemp"),
  panelSetTemp: document.querySelector("#panelSetTemp"),
  controlTemp: document.querySelector("#controlTemp"),
  tempDown: document.querySelector("#tempDown"),
  tempUp: document.querySelector("#tempUp"),
  controlPower: document.querySelector("#controlPower"),
  controlMode: document.querySelector("#controlMode"),
  controlFan: document.querySelector("#controlFan"),
  controlFlow1: document.querySelector("#controlFlow1"),
  controlFlow2: document.querySelector("#controlFlow2")
};

els.refreshButton.addEventListener("click", () => loadUnits());
els.closePanel.addEventListener("click", closePanel);
els.panelBackdrop.addEventListener("click", closePanel);
els.editAlias.addEventListener("click", toggleAliasForm);
els.aliasForm.addEventListener("submit", saveAlias);
els.tempDown.addEventListener("click", () => updateSelected({ tempSet: Math.max(16, state.selectedUnit.tempSet - 1) }));
els.tempUp.addEventListener("click", () => updateSelected({ tempSet: Math.min(32, state.selectedUnit.tempSet + 1) }));
els.controlPower.addEventListener("change", () => updateSelected({ on: els.controlPower.checked ? 1 : 0 }));
els.controlMode.addEventListener("change", () => updateSelected({ mode: Number(els.controlMode.value) }));
els.controlFan.addEventListener("change", () => updateSelected({ fan: Number(els.controlFan.value) }));
els.controlFlow1.addEventListener("change", () => updateSelected({ FlowDirection1: Number(els.controlFlow1.value) }));
els.controlFlow2.addEventListener("change", () => updateSelected({ FlowDirection2: Number(els.controlFlow2.value) }));
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
    syncSelectedUnit();
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
  const displayName = getDisplayName(unit);
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
  els.aliasForm.classList.add("hidden");
  els.panelTitle.textContent = displayName;
  els.aliasInput.value = unit.alias || "";
  fillSelect(els.controlMode, state.modes, unit.mode);
  fillSelect(els.controlFan, state.fans, unit.fan);
  fillSelect(els.controlFlow1, flow1Options, unit.FlowDirection1);
  fillSelect(els.controlFlow2, flow2Options, unit.FlowDirection2);
  renderPanelState(unit, stateName);
  els.panelBackdrop.classList.remove("hidden");
  els.detailPanel.classList.remove("hidden");
}

function closePanel() {
  state.selectedUnit = null;
  els.panelBackdrop.classList.add("hidden");
  els.detailPanel.classList.add("hidden");
}

function renderPanelState(unit, stateName = getStateName(unit)) {
  els.panelTitle.textContent = getDisplayName(unit);
  els.panelState.textContent = stateName;
  els.panelRoomTemp.textContent = `${unit.tempIn}°`;
  els.panelSetTemp.textContent = `${unit.tempSet}°`;
  els.controlTemp.textContent = `${unit.tempSet}°`;
  els.controlPower.checked = unit.on === 1;
  els.controlMode.value = String(unit.mode);
  els.controlFan.value = String(unit.fan);
  els.controlFlow1.value = String(unit.FlowDirection1);
  els.controlFlow2.value = String(unit.FlowDirection2);
}

async function updateSelected(patch) {
  if (!state.selectedUnit || state.panelBusy) return;
  setPanelBusy(true);

  try {
    await api(`/api/units/${state.selectedUnit.idx}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch)
    });
    await loadUnits();
  } catch (error) {
    showMessage(error.message);
    await loadUnits();
  } finally {
    setPanelBusy(false);
  }
}

function toggleAliasForm() {
  if (!state.selectedUnit) return;
  els.aliasInput.value = state.selectedUnit.alias || "";
  els.aliasForm.classList.toggle("hidden");
  if (!els.aliasForm.classList.contains("hidden")) els.aliasInput.focus();
}

async function saveAlias(event) {
  event.preventDefault();
  if (!state.selectedUnit) return;

  const alias = els.aliasInput.value.trim();
  setPanelBusy(true);
  try {
    await api(`/api/units/${state.selectedUnit.idx}/alias`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias })
    });
    els.aliasForm.classList.add("hidden");
    await loadUnits();
  } catch (error) {
    showMessage(error.message);
  } finally {
    setPanelBusy(false);
  }
}

function syncSelectedUnit() {
  if (!state.selectedUnit) return;

  const next = state.units.find((unit) => unit.idx === state.selectedUnit.idx);
  if (!next) {
    closePanel();
    return;
  }

  state.selectedUnit = next;
  if (!els.detailPanel.classList.contains("hidden")) {
    renderPanelState(next);
  }
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

function setPanelBusy(isBusy) {
  state.panelBusy = isBusy;
  els.detailPanel.dataset.busy = isBusy ? "true" : "false";
  for (const control of [
    els.tempDown,
    els.tempUp,
    els.controlPower,
    els.controlMode,
    els.controlFan,
    els.controlFlow1,
    els.controlFlow2,
    els.editAlias,
    els.aliasInput
  ]) {
    control.disabled = isBusy;
  }
}

function showMessage(message) {
  els.message.textContent = message;
  els.message.classList.remove("hidden");
}

function hideMessage() {
  els.message.textContent = "";
  els.message.classList.add("hidden");
}
