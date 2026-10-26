import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing lat or lon parameters' }, { status: 400 });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&addressdetails=1&zoom=18`;
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

  return NextResponse.json({
    display_name: `Pinned GPS (${lat}, ${lon}), Nairobi, Kenya`,
    address: {
      city: 'Nairobi',
      county: 'Nairobi',
      country: 'Kenya',
    },
  });
}
