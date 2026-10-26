import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    latitude: -1.286389,
    longitude: 36.817223,
    city: 'Nairobi',
    country: 'Kenya',
  });
}
