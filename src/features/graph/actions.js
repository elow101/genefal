export function setViewModeAction(state, mode) {
  state.mode = mode;
  return state.mode;
}

export function nextGraphZoom(currentZoom, delta, { min = 0.55, max = 1.8 } = {}) {
  return Math.max(min, Math.min(max, Number((currentZoom + delta).toFixed(2))));
}

export function updateGraphZoomAction(state, delta, { shouldReset = false, min = 0.55, max = 1.8 } = {}) {
  state.graphZoom = shouldReset ? 1 : nextGraphZoom(state.graphZoom, delta, { min, max });
  return state.graphZoom;
}
