export function isDatabaseV2ReplaceV1Enabled() {
  return process.env.DATABASE_V2_REPLACE_V1 !== "false";
}

export function isDatabaseV2RadarRealtimeEnabled() {
  return process.env.DATABASE_V2_RADAR_REALTIME_ENABLED !== "false";
}

export function isDatabaseV2StrictRequiredFieldsEnabled() {
  return process.env.DATABASE_V2_STRICT_REQUIRED_FIELDS !== "false";
}
