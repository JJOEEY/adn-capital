import {
  PayOS,
  type CreatePaymentLinkRequest,
  type CreatePaymentLinkResponse,
  type Webhook,
  type WebhookData,
} from "@payos/node";

export interface VipPlan {
  id: string;
  name: string;
  days: number;
  price: number;
  dnsePrice: number;
  description: string;
  disabledForCheckout?: boolean;
}

export const VIP_PLANS: Record<string, VipPlan> = {
  "1m": {
    id: "1m",
    name: "Gói 1 tháng",
    days: 30,
    price: 249_000,
    dnsePrice: 224_000,
    description: "VIP 1 tháng ADN Capital",
    disabledForCheckout: true,
  },
  "3m": {
    id: "3m",
    name: "Gói 3 tháng",
    days: 90,
    price: 649_000,
    dnsePrice: 519_000,
    description: "VIP 3 tháng ADN Capital",
  },
  "6m": {
    id: "6m",
    name: "Gói 6 tháng",
    days: 180,
    price: 1_199_000,
    dnsePrice: 839_000,
    description: "VIP 6 tháng ADN Capital",
  },
  "12m": {
    id: "12m",
    name: "Gói 12 tháng",
    days: 365,
    price: 1_999_000,
    dnsePrice: 1_199_000,
    description: "VIP 12 tháng ADN Capital",
  },
};

export function layPlan(planId: string): VipPlan | null {
  return VIP_PLANS[planId] ?? null;
}

let payosClient: PayOS | null = null;

function requireEnv(name: string, value?: string) {
  if (!value) {
    throw new Error(
      `Thiếu biến môi trường ${name}. Hãy cấu hình PAYOS_CLIENT_ID, PAYOS_API_KEY và PAYOS_CHECKSUM_KEY trước khi dùng PayOS.`,
    );
  }

  return value;
}

function createPayOSClient() {
  return new PayOS({
    clientId: requireEnv("PAYOS_CLIENT_ID", process.env.PAYOS_CLIENT_ID),
    apiKey: requireEnv("PAYOS_API_KEY", process.env.PAYOS_API_KEY),
    checksumKey: requireEnv("PAYOS_CHECKSUM_KEY", process.env.PAYOS_CHECKSUM_KEY),
  });
}

export function layPayOS() {
  if (!payosClient) {
    payosClient = createPayOSClient();
  }

  return payosClient;
}

export function taoMaDonHangPayOS() {
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return Number(`${Date.now()}${randomSuffix}`);
}

export const payos = {
  async createPaymentLink(paymentData: CreatePaymentLinkRequest): Promise<CreatePaymentLinkResponse> {
    return layPayOS().paymentRequests.create(paymentData);
  },

  async verifyPaymentWebhookData(webhookData: Webhook): Promise<WebhookData> {
    return layPayOS().webhooks.verify(webhookData);
  },

  async confirmWebhook(webhookUrl: string) {
    return layPayOS().webhooks.confirm(webhookUrl);
  },
};

export type DuLieuWebhookPayOS = Webhook;
export type DuLieuWebhookDaXacThuc = WebhookData;
