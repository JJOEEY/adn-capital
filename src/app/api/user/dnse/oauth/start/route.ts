import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildDnseAuthorizeUrl, getDnseOAuthConfig } from "@/lib/brokers/dnse/oauth";
import { createDnseOAuthState } from "@/lib/brokers/dnse/connection";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const config = getDnseOAuthConfig();
  if (!config.configured) {
    return NextResponse.json(
      {
        error: "DNSE OAuth chưa được cấu hình đầy đủ",
        missing: config.missing,
      },
      { status: 503 },
    );
  }

  const oauthState = await createDnseOAuthState(userId, config.redirectUri);
  const url = buildDnseAuthorizeUrl({
    state: oauthState.state,
    codeChallenge: oauthState.challenge,
  });

  return NextResponse.redirect(url);
}
