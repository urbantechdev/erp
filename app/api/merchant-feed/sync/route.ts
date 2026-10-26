import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const count = Array.isArray(body?.products) ? body.products.length : 0;
  return NextResponse.json({
    success: true,
    syncedCount: count,
    syncedAt: new Date().toISOString(),
  });
}
