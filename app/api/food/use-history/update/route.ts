export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/food/use-history/update
// body: { id, use_date?, use_amount? }
// - Inserts a compensating settle_entry for the delta difference (owner符号考慮)
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

    const newDate = body?.use_date !== undefined ? String(body.use_date).trim() : log.use_date;
    const newAmount = body?.use_amount !== undefined ? Number(body.use_amount) : Number(log.use_amount);

    if (!Number.isFinite(newAmount) || newAmount <= 0)
      return NextResponse.json({ error: "use_amount invalid" }, { status: 400 });

    const apu = Math.abs(Number(log.amount_per_unit)); // 念のため絶対値
    const oldDelta = Number(log.settle_delta);
    // なつの食材→+（たかが返す）、たかの食材→-（なつが返す）
    const sign = log.owner === "natsu" ? 1 : -1;
    const newDelta = Math.round(apu * newAmount / 2) * sign;
    const deltaDiff = newDelta - oldDelta;

    // Insert compensating settle_entry if settle_delta changed
    if (deltaDiff !== 0) {
      const { error: settleError } = await supabase.from("settle_entries").insert({
        date: newDate,
        delta: deltaDiff,
        source: "food_use_correction",
        meta: { log_id: id, item_id: log.item_id, item_name: log.item_name },
      });
      if (settleError) throw settleError;
    }

    // Update the log (food_items.remain は変更しない)
    const { error: updateError } = await supabase
      .from("food_use_logs")
      .update({ use_date: newDate, use_amount: newAmount, settle_delta: newDelta })
      .eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
