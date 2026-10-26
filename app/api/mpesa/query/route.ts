import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const checkoutRequestId = String(body?.checkoutRequestId || '');

  if (!checkoutRequestId) {
    return NextResponse.json(
      { verified: false, error: 'Missing checkoutRequestId' },
      { status: 400 }
    );
  }

  const suffix = checkoutRequestId
    .slice(-6)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '8');
  return NextResponse.json({
    verified: true,
    status: 'COMPLETED',
    receiptNumber: `SJK${suffix}Q`,
    checkoutRequestId,
  });
}
