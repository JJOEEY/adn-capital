/**
 * NextAuth v5 – Route handler.
 * Xử lý tất cả request /api/auth/* (signin, signout, callback, v.v.)
 */

import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
