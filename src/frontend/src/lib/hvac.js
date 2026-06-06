export const flow1Options = [
  { value: 0, label: "Keep" },
  { value: 1, label: "Position 1" },
  { value: 2, label: "Position 2" },
  { value: 3, label: "Position 3" },
  { value: 4, label: "Position 4" },
  { value: 5, label: "Position 5" },
  { value: 6, label: "Position 6" },
  { value: 7, label: "Position 7" }
];

export const flow2Options = [
  { value: 0, label: "Keep" },
  { value: 1, label: "Position 1" },
  { value: 2, label: "Position 2" },
  { value: 3, label: "Position 3" },
  { value: 4, label: "Position 4" },
  { value: 5, label: "Position 5" },
  { value: 6, label: "Position 6" }
];

export function getCardState(unit) {
  if (unit.alarm !== 0) return "warning";
  if (unit.on === 1) return "running";
  return "off";
}

export function getStateName(unit) {
  if (unit.alarm !== 0) return "Needs attention";
  if (unit.on === 1) return "Running";
  return "Off";
}

export function getDisplayName(unit) {
  return unit.alias || `Unit ${unit.idx + 1}`;
}

export async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed ${response.status}`);
  return payload;
}
