export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/food/use-history/delete
// body: { id }
// - Inserts a reverse settle_entry to cancel the original
// - Restores food_items.remain
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

    const useAmount = Number(log.use_amount);
    const settleDelta = Number(log.settle_delta);

    // Insert reverse settle_entry to cancel original
    if (settleDelta !== 0) {
      const { error: settleError } = await supabase.from("settle_entries").insert({
        date: log.use_date,
        delta: -settleDelta,
        source: "food_use_correction",
        meta: { log_id: id, item_id: log.item_id, item_name: log.item_name, action: "delete" },
      });
      if (settleError) throw settleError;
    }

    // Restore food_items.remain
    const { data: item, error: itemFetchError } = await supabase
      .from("food_items")
      .select("remain")
      .eq("owner", log.owner)
      .eq("item_id", log.item_id)
      .single();

    if (!itemFetchError && item) {
      const newRemain = Number(item.remain) + useAmount;
      await supabase
        .from("food_items")
        .update({ remain: newRemain })
        .eq("owner", log.owner)
        .eq("item_id", log.item_id);
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
