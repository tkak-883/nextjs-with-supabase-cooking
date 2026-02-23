import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toDbOwner(ownerParam: string) {
  const o = (ownerParam || "").trim();
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const owner = toDbOwner(body?.owner);
    const date = String(body?.date ?? "").trim();
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
    if (rows.length === 0) return NextResponse.json({ error: "rows required" }, { status: 400 });

    const cleanRows = rows
      .map((r: any) => ({
        item_id: String(r?.item_id ?? "").trim(),
        use_amount: Number(r?.useAmount ?? r?.use_amount),
      }))
      .filter((r: any) => r.item_id && Number.isFinite(r.use_amount) && r.use_amount > 0);

    if (cleanRows.length === 0) {
      return NextResponse.json({ error: "rows empty after validation" }, { status: 400 });
    }

    // Pre-fetch item details for logging
    const itemIds = cleanRows.map((r: any) => r.item_id);
    const { data: itemData, error: itemError } = await supabase
      .from("food_items")
      .select("item_id, name, amount_per_unit")
      .eq("owner", owner)
      .in("item_id", itemIds);
    if (itemError) throw itemError;

    const itemMap = new Map((itemData ?? []).map((it) => [it.item_id, it]));

    const { data, error } = await supabase.rpc("food_use", {
      p_owner: owner,
      p_date: date,
      p_rows: cleanRows, // jsonb
    });

    if (error) throw error;

    // Insert use logs
    const logs = cleanRows
      .map((r: any) => {
        const it = itemMap.get(r.item_id);
        if (!it) return null;
        const apu = Math.abs(Number(it.amount_per_unit) || 0); // 念のため絶対値
        return {
          owner,
          use_date: date,
          item_id: r.item_id,
          item_name: it.name,
          use_amount: r.use_amount,
          amount_per_unit: apu,
          // なつの食材→+（たかが返す）、たかの食材→-（なつが返す）。半額が精算額
          settle_delta: Math.round(apu * r.use_amount / 2) * (owner === "natsu" ? 1 : -1),
        };
      })
      .filter(Boolean);

    if (logs.length > 0) {
      const { error: logError } = await supabase.from("food_use_logs").insert(logs);
      if (logError) console.error("log insert error:", logError);
    }

    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
