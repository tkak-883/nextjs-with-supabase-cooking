export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/food/use-history/delete
// body: { id }
// - Inserts a reverse settle_entry to cancel the original (settle_delta の符号はログに保存済み)
// - food_items.remain は変更しない（過去ログ修正は精算のみに影響）
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const id = Number(body?.id);
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Fetch current log
    const { data: log, error: fetchError } = await supabase
      .from("food_use_logs")
      .select("*")
      .eq("id", id)
      .single();
    if (fetchError) throw fetchError;
    if (!log) return NextResponse.json({ error: "log not found" }, { status: 404 });

    const settleDelta = Number(log.settle_delta);

    // Insert reverse settle_entry to cancel original (food_items.remain は変更しない)
    if (settleDelta !== 0) {
      const { error: settleError } = await supabase.from("settle_entries").insert({
        date: log.use_date,
        delta: -settleDelta,
        source: "food_use_correction",
        meta: { log_id: id, item_id: log.item_id, item_name: log.item_name, action: "delete" },
      });
      if (settleError) throw settleError;
    }

    // Delete the log
    const { error: deleteError } = await supabase.from("food_use_logs").delete().eq("id", id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
