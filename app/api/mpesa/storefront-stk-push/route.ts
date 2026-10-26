import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = String(body?.phone || '');
  const checkoutToken = String(body?.checkoutToken || '');

  if (!checkoutToken || !phone) {
    return NextResponse.json(
      { success: false, error: 'Missing checkoutToken or phone number.' },
      { status: 400 }
    );
  }

  const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
  return NextResponse.json({
    success: true,
    checkoutRequestId,
    customerMessage: `STK Push dispatched to ${phone}. Enter your M-Pesa PIN on your handset.`,
  });
}
