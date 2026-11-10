// Feature flags for the "dates and likes for stamps" feature. Off unless the
// variable is exactly "1" or "true".
function on(name: string): boolean {
  const v = process.env[name];
  return v === "1" || v === "true";
}

/** Prompt, Mis fechas, stamps, new admin panel and the dueReminders permission change. */
export function dateRewardsEnabled(): boolean {
  return on("DATE_REWARDS_ENABLED");
}

/** The 3-day reminder message. */
export function d3RemindersEnabled(): boolean {
  return on("DATE_REMINDER_D3_ENABLED");
}
