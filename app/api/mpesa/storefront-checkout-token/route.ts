import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const orderId = body?.orderId || `ORD-${Date.now()}`;
  const checkoutToken = `chk_${Buffer.from(`${orderId}:${Date.now()}`).toString('base64url')}`;

  return NextResponse.json({
    success: true,
    checkoutToken,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
}
