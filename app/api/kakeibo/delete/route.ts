export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/kakeibo/delete
// body: { id }
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const id = body?.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // 対応するsettle_entriesを削除（kakeibo_idリンクがある場合）
    const { error: settleError } = await supabase
      .from("settle_entries")
      .delete()
      .eq("source", "payment")
      .filter("meta->>kakeibo_id", "eq", String(id));

    if (settleError) throw settleError;

    const { error } = await supabase
      .from("kakeibo_entries")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
