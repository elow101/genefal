export function requestCountLabel(count) {
  return `${count} demande${count > 1 ? "s" : ""}`;
}

export function shouldKeepUpcomingEvent(event, isExpired) {
  return event && !isExpired(event);
}
