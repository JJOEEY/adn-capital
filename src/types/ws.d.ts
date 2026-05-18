declare module "ws" {
  export default class WebSocket {
    constructor(url: string, options?: { handshakeTimeout?: number });
    once(event: string, listener: (...args: unknown[]) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    off(event: string, listener: (...args: unknown[]) => void): void;
    send(payload: string): void;
    close(): void;
    terminate(): void;
  }
}

declare module "next/dist/compiled/ws" {
  export default class WebSocket {
    constructor(url: string, options?: { handshakeTimeout?: number });
    once(event: string, listener: (...args: unknown[]) => void): void;
    on(event: string, listener: (...args: unknown[]) => void): void;
    off(event: string, listener: (...args: unknown[]) => void): void;
    send(payload: string): void;
    close(): void;
    terminate(): void;
  }
}
