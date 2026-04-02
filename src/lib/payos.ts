import {
  PayOS,
  type CreatePaymentLinkRequest,
  type CreatePaymentLinkResponse,
  type Webhook,
  type WebhookData,
} from "@payos/node";

export const GIA_GOI_VIP_VND = 1_000_000;
export const SO_NGAY_VIP = 30;
export const MO_TA_GOI_VIP = "Nang cap VIP ADN Bot";
export const TEN_SAN_PHAM_VIP = "Goi VIP ADN Bot";

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