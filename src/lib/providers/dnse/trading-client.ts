import { DnseTradingClient, getDnseTradingClient as getServerDnseTradingClient } from "./trading-client.server";

export { DnseTradingClient };
export type {
  DnseAccount as DnseTradingAccount,
  DnseBalance as DnseTradingBalance,
  DnsePosition as DnseTradingPosition,
  DnseOrder as DnseTradingOrder,
} from "./trading-client.server";

export function getDnseTradingClient(options?: { userJwtToken?: string | null; isolated?: boolean }) {
  return getServerDnseTradingClient(options);
}
