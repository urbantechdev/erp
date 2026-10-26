import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const countrycodes = searchParams.get('countrycodes') || 'ke';

  if (q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      q.trim()
    )}&addressdetails=1&limit=8&countrycodes=${encodeURIComponent(countrycodes)}`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'AegisSpiritsERP/1.0',
      },
    });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    // Fallback below
  }

  return NextResponse.json([]);
}
