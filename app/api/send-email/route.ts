import { NextResponse } from 'next/server';
import { sendSlaAlertEmail } from '@/lib/emailService';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = await sendSlaAlertEmail(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('❌ Failed to send SLA alert email route handler:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to dispatch email'
    }, { status: 500 });
  }
}
