import { NextResponse } from 'next/server';
import { getLiveProviderStatus } from '@/lib/agent/liveRunner';

export async function GET() {
  const status = getLiveProviderStatus();
  return NextResponse.json(status, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
