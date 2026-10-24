import { NextResponse } from 'next/server';
import { RunAgentRequestSchema } from '@/lib/schemas';
import { getSnapshotById } from '@/data/snapshots';
import { runSimulatedAgent } from '@/lib/agent/simulatedRunner';
import { runLiveAgent } from '@/lib/agent/liveRunner';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = RunAgentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid agent run request payload',
          details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
        },
        { status: 400 }
      );
    }

    const snapshot = getSnapshotById(parsed.data.snapshotId);
    if (!snapshot) {
      return NextResponse.json(
        { error: `Unknown repository snapshot ID "${parsed.data.snapshotId}".` },
        { status: 404 }
      );
    }

    if (parsed.data.mode === 'simulation') {
      const simRun = runSimulatedAgent({
        snapshot,
        promptVersion: parsed.data.promptVersion,
        budgetsOverride: parsed.data.budgetsOverride,
      });
      return NextResponse.json({ run: simRun }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const liveRun = await runLiveAgent({
      snapshot,
      promptVersion: parsed.data.promptVersion,
      budgetsOverride: parsed.data.budgetsOverride,
    });
    return NextResponse.json({ run: liveRun }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
