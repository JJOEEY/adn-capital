import {
  PayOS,
  type CreatePaymentLinkRequest,
  type CreatePaymentLinkResponse,
  type Webhook,
  type WebhookData,
} from "@payos/node";

/* ═══════════════════════════════════════════════════════════════════════════
 *  PLAN DEFINITIONS
 * ═══════════════════════════════════════════════════════════════════════════ */
export interface VipPlan {
  id: string;
  name: string;
  days: number;
  price: number;       // giá niêm yết (VND)
  dnsePrice: number;   // giá KH DNSE (VND)
  description: string;
}

export const VIP_PLANS: Record<string, VipPlan> = {
  "1m":  { id: "1m",  name: "Gói 1 Tháng",   days: 30,  price: 249_000,   dnsePrice: 224_000,   description: "VIP 1 Thang ADN Capital" },
  "3m":  { id: "3m",  name: "Gói 3 Tháng",   days: 90,  price: 649_000,   dnsePrice: 519_000,   description: "VIP 3 Thang ADN Capital" },
  "6m":  { id: "6m",  name: "Gói 6 Tháng",   days: 180, price: 1_199_000, dnsePrice: 839_000,   description: "VIP 6 Thang ADN Capital" },
  "12m": { id: "12m", name: "Gói 12 Tháng",  days: 365, price: 1_999_000, dnsePrice: 1_199_000, description: "VIP 12 Thang ADN Capital" },
};

export function layPlan(planId: string): VipPlan | null {
  return VIP_PLANS[planId] ?? null;
}

let payosClient: PayOS | null = null;

function layBienMoiTruongBatBuoc(tenBien: string, giaTri?: string) {
  if (!giaTri) {
    throw new Error(
      `Thiếu biến môi trường ${tenBien}. Hãy thêm PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY vào .env.local trước khi dùng PayOS.`,
    );
  }

  return giaTri;
}

function taoPayOSClient() {
  return new PayOS({
    clientId: layBienMoiTruongBatBuoc(
      "PAYOS_CLIENT_ID",
      process.env.PAYOS_CLIENT_ID,
    ),
    apiKey: layBienMoiTruongBatBuoc(
      "PAYOS_API_KEY",
      process.env.PAYOS_API_KEY,
    ),
    checksumKey: layBienMoiTruongBatBuoc(
      "PAYOS_CHECKSUM_KEY",
      process.env.PAYOS_CHECKSUM_KEY,
    ),
  });
}

export function layPayOS() {
  if (!payosClient) {
    payosClient = taoPayOSClient();
  }

  return payosClient;
}

export function taoMaDonHangPayOS() {
  const duoiNgauNhien = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return Number(`${Date.now()}${duoiNgauNhien}`);
}

export const payos = {
  async createPaymentLink(duLieuThanhToan: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
    return layPayOS().paymentRequests.create(duLieuThanhToan);
  },

  async verifyPaymentWebhookData(duLieuWebhook: Webhook): Promise<WebhookData> {
    return layPayOS().webhooks.verify(duLieuWebhook);
  },

  async confirmWebhook(webhookUrl: string) {
    return layPayOS().webhooks.confirm(webhookUrl);
  },
};

export type DuLieuWebhookPayOS = Webhook;
export type DuLieuWebhookDaXacThuc = WebhookData;