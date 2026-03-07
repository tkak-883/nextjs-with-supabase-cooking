export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/settle/add
// body: { delta, date, note? }
// 家計簿に影響しない手動精算エントリを追加する
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const delta = Number(body?.delta);
    const date = String(body?.date ?? "").trim();
    const note = String(body?.note ?? "");

    if (!Number.isFinite(delta) || delta === 0)
      return NextResponse.json({ error: "delta must be non-zero number" }, { status: 400 });
    if (!date)
      return NextResponse.json({ error: "date required" }, { status: 400 });

    const { error } = await supabase.from("settle_entries").insert({
      date,
      delta,
      source: "manual",
      meta: { note },
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
