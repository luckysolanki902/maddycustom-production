import { NextResponse } from 'next/server';
import getHelpingData from '@/lib/faq/getHelpingData';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const text = await getHelpingData();

    if ((format || '').toLowerCase() === 'txt') {
      return new NextResponse(text, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' }
      });
    }
    return NextResponse.json({ ok: true, length: (text || '').length, sample: (text || '').slice(0, 500) }, { status: 200 });
  } catch (e) {
    console.log('[temp-debug] /api/dev/helping-data error:', e?.message || e);
    return NextResponse.json({ ok: false, error: 'failed to compose helping data' }, { status: 500 });
  }
}
