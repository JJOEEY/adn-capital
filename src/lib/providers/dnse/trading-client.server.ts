import crypto from 'crypto';

export interface DnseAccount {
  accountNo: string;
  accountName: string;
  custodyCode: string;
  accountType: string;
  status: string;
}

export interface DnseBalance {
  accountNo: string;
  cashBalance: number;
  cashWithdrawable: number;
  cashAvailable: number;
  totalAsset: number;
  totalDebt: number;
  netAssetValue: number;
  cash?: number;
  buyingPower?: number;
  totalNav?: number;
  debt?: number;
  marginRatio?: number;
  maintenanceMargin?: number;
}

export interface DnsePosition {
  accountNo: string;
  symbol: string;
  ticker?: string;
  quantity: number;
  availableQty: number;
  avgPrice: number;
  lastPrice: number;
  marketValue: number;
  totalPL: number;
  totalPLPct: number;
  weight: number;
}

export interface DnseOrder {
  orderId: string;
  accountNo: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  price: number;
  quantity: number;
  filledQty: number;
  remainingQty: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export class DnseTradingClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;
  private tradingToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(apiKey: string, apiSecret: string, baseUrl = 'https://openapi.dnse.com.vn') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
  }

  /**
   * Tạo HMAC SHA256 signature
   */
  private generateSignature(auxDate: string): string {
    // Message = X-API-Key + X-Aux-Date
    const message = this.apiKey + auxDate;

    // HMAC SHA256
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(message)
      .digest('hex');
  }

  /**
   * Get common headers with signature
   */
  private getHeaders(includeBody: boolean = false): Record<string, string> {
    const auxDate = new Date().toISOString();
    const signature = this.generateSignature(auxDate);

    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      'X-Aux-Date': auxDate,
      'X-Signature': signature,
      'Content-Type': 'application/json',
    };

    return headers;
  }

  /**
   * Get all trading accounts
   */
  async getAccounts(): Promise<DnseAccount[]> {
    const res = await fetch(`${this.baseUrl}/accounts`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to get accounts: ${res.status} ${error}`);
    }

    const data = await res.json();
    return data.data || data;
  }

  /**
   * Get account balance
   */
  async getBalance(accountNo: string): Promise<DnseBalance> {
    const res = await fetch(`${this.baseUrl}/accounts/${accountNo}/balances`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to get balance: ${res.statusText}`);
    }

    const data = await res.json();
    const balance = (data.data || data) as DnseBalance;
    return {
      ...balance,
      accountNo: balance.accountNo || accountNo,
      cash: balance.cash ?? balance.cashBalance ?? balance.cashAvailable ?? 0,
      buyingPower: balance.buyingPower ?? balance.cashAvailable ?? 0,
      totalNav: balance.totalNav ?? balance.netAssetValue ?? balance.totalAsset ?? 0,
      debt: balance.debt ?? balance.totalDebt ?? 0,
    };
  }

  /**
   * Get current positions
   */
  async getPositions(accountNo: string): Promise<DnsePosition[]> {
    const res = await fetch(`${this.baseUrl}/accounts/${accountNo}/positions`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to get positions: ${res.statusText}`);
    }

    const data = await res.json();
    const positions = data.data || data;

    // Calculate weights
    const totalMarketValue = positions.reduce((sum: number, p: any) => 
      sum + (p.marketValue || 0), 0
    );

    return positions.map((p: any) => ({
      ...p,
      ticker: p.ticker || p.symbol,
      totalPLPct: p.avgPrice > 0 ? ((p.lastPrice - p.avgPrice) / p.avgPrice) * 100 : 0,
      weight: totalMarketValue > 0 ? (p.marketValue / totalMarketValue) * 100 : 0,
    }));
  }

  /**
   * Get orders
   */
  async getOrders(accountNo: string): Promise<DnseOrder[]> {
    const res = await fetch(`${this.baseUrl}/accounts/${accountNo}/orders`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to get orders: ${res.statusText}`);
    }

    const data = await res.json();
    return data.data || data;
  }

  /**
   * Get loan packages
   */
  async getLoanPackages(accountNo: string): Promise<any[]> {
    const res = await fetch(`${this.baseUrl}/accounts/${accountNo}/loan-packages`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      throw new Error(`Failed to get loan packages: ${res.statusText}`);
    }

    const data = await res.json();
    return data.data || data;
  }

  /**
   * Get PPSE (Buying/Selling Power)
   */
  async getPPSE(accountNo: string, symbol: string): Promise<any> {
    const res = await fetch(
      `${this.baseUrl}/accounts/${accountNo}/ppse?symbol=${symbol}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!res.ok) {
      throw new Error(`Failed to get PPSE: ${res.statusText}`);
    }

    const data = await res.json();
    return data.data || data;
  }

  /**
   * Send Email OTP
   */
  async sendEmailOTP(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/otp/email/send`, {
      method: 'POST',
      headers: this.getHeaders(true),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to send OTP: ${error}`);
    }
  }

  /**
   * Create trading token with OTP
   */
  async createTradingToken(otp: string): Promise<{ token: string; expiresIn: number }> {
    const res = await fetch(`${this.baseUrl}/auth/trading-token`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify({ otp }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Invalid OTP: ${error}`);
    }

    const data = await res.json();
    this.tradingToken = data.token;
    this.tokenExpiry = Date.now() + data.expiresIn * 1000;

    return data;
  }

  /**
   * Set trading token from external source
   */
  setTradingToken(token: string, expiresIn: number = 25200) {
    this.tradingToken = token;
    this.tokenExpiry = Date.now() + expiresIn * 1000;
  }

  /**
   * Place order (requires trading token)
   */
  async placeOrder(params: {
    accountNo: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    orderType: string;
    price?: number;
    quantity: number;
    loanPackageId?: string;
  }): Promise<{ orderId: string }> {
    if (!this.tradingToken || Date.now() > this.tokenExpiry) {
      throw new Error('Trading token required. Please authenticate with OTP first.');
    }

    const queryParams = new URLSearchParams({
      marketType: 'STOCK',
      orderCategory: 'NORMAL',
    });

    const headers = {
      ...this.getHeaders(true),
      'trading-token': this.tradingToken,
    };

    const res = await fetch(
      `${this.baseUrl}/accounts/orders?${queryParams.toString()}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          accountNo: params.accountNo,
          symbol: params.symbol,
          side: params.side,
          orderType: params.orderType,
          price: params.price,
          quantity: params.quantity,
          loanPackageId: params.loanPackageId,
        }),
      }
    );

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Failed to place order: ${error}`);
    }

    return await res.json();
  }

  /**
   * Cancel order
   */
  async cancelOrder(accountNo: string, orderId: string): Promise<void> {
    if (!this.tradingToken) {
      throw new Error('Trading token required');
    }

    const headers = {
      ...this.getHeaders(),
      'trading-token': this.tradingToken,
    };

    const res = await fetch(`${this.baseUrl}/accounts/${accountNo}/orders/${orderId}`, {
      method: 'DELETE',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Failed to cancel order: ${res.statusText}`);
    }
  }
}

// Singleton instance
let clientInstance: DnseTradingClient | null = null;

export function getDnseTradingClient(): DnseTradingClient {
  if (!clientInstance) {
    const apiKey = process.env.DNSE_API_KEY;
    const apiSecret = process.env.DNSE_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('DNSE_API_KEY và DNSE_API_SECRET không được cấu hình trong .env');
    }

    clientInstance = new DnseTradingClient(apiKey, apiSecret);
  }

  return clientInstance;
}
