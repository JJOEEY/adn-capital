import dayjs, { type Dayjs } from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "dayjs/locale/vi";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("vi");

export const VN_TIMEZONE = "Asia/Ho_Chi_Minh";

export function toVnTime(input?: string | number | Date | Dayjs | null): Dayjs {
  if (input == null) return dayjs().tz(VN_TIMEZONE);
  return dayjs(input).tz(VN_TIMEZONE);
}

export function getVnNow(): Dayjs {
  return dayjs().tz(VN_TIMEZONE);
}

export function getVnDateISO(input?: string | number | Date | Dayjs | null): string {
  return toVnTime(input).format("YYYY-MM-DD");
}

export function getVnDateLabel(input?: string | number | Date | Dayjs | null): string {
  return toVnTime(input).format("dddd, D [tháng] M, YYYY");
}

export function getVnTimeLabel(input?: string | number | Date | Dayjs | null): string {
  return toVnTime(input).format("HH:mm");
}

export function isVnTradingDay(input?: string | number | Date | Dayjs | null): boolean {
  const day = toVnTime(input).day();
  return day >= 1 && day <= 5;
}

export function isWithinVnTradingSession(input?: string | number | Date | Dayjs | null): boolean {
  const now = toVnTime(input);
  const total = now.hour() * 60 + now.minute();
  const morning = total >= 9 * 60 && total <= 11 * 60 + 30;
  const afternoon = total >= 13 * 60 && total <= 15 * 60;
  return isVnTradingDay(now) && (morning || afternoon);
}

export function formatLocalDeviceDateTime(
  input: string | Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(input);
  return date.toLocaleString(undefined, options);
}

export function formatLocalDeviceDate(
  input: string | Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(input);
  return date.toLocaleDateString(undefined, options);
}

export function formatLocalDeviceTime(
  input: string | Date | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = new Date(input);
  return date.toLocaleTimeString(undefined, options);
}
