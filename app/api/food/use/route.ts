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
    const fixedItems = Array.isArray(body?.fixed_items) ? body.fixed_items : [];

    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });
    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

    const cleanRows = rows
      .map((r: any) => ({
        item_id: String(r?.item_id ?? "").trim(),
        use_amount: Number(r?.useAmount ?? r?.use_amount),
      }))
      .filter((r: any) => r.item_id && Number.isFinite(r.use_amount) && r.use_amount > 0);

    const cleanFixed = fixedItems
      .map((f: any) => ({
        name: String(f?.name ?? "").trim(),
        amount: Number(f?.amount),
      }))
      .filter((f: any) => f.name && Number.isFinite(f.amount) && f.amount > 0);

    if (cleanRows.length === 0 && cleanFixed.length === 0) {
      return NextResponse.json({ error: "rows required" }, { status: 400 });
    }

    const sign = owner === "natsu" ? 1 : -1; // なつ→+（たかが返す）、たか→-（なつが返す）

    let rpcData: any = {};

    // --- 通常の食材 ---
    if (cleanRows.length > 0) {
      // Pre-fetch item details for logging
      const itemIds = cleanRows.map((r: any) => r.item_id);
      const { data: itemData, error: itemError } = await supabase
        .from("food_items")
        .select("item_id, name, amount_per_unit, unit")
        .eq("owner", owner)
        .in("item_id", itemIds);
      if (itemError) throw itemError;

      const itemMap = new Map((itemData ?? []).map((it) => [it.item_id, it]));

      const { data, error } = await supabase.rpc("food_use", {
        p_owner: owner,
        p_date: date,
        p_rows: cleanRows,
      });
      if (error) throw error;
      rpcData = data ?? {};

      const logs = cleanRows
        .map((r: any) => {
          const it = itemMap.get(r.item_id);
          if (!it) return null;
          const apu = Math.abs(Number(it.amount_per_unit) || 0);
          return {
            owner,
            use_date: date,
            item_id: r.item_id,
            item_name: it.name,
            use_amount: r.use_amount,
            amount_per_unit: apu,
            unit: it.unit ?? "",
            settle_delta: Math.round(apu * r.use_amount / 2) * sign,
          };
        })
        .filter(Boolean);

      if (logs.length > 0) {
        const { error: logError } = await supabase.from("food_use_logs").insert(logs);
        if (logError) console.error("food log insert error:", logError);
      }
    }

    // --- 固定費（調味料・水道光熱費など） ---
    let fixedDeltaTotal = 0;
    for (const fi of cleanFixed) {
      const settleDelta = Math.round(fi.amount / 2) * sign;
      fixedDeltaTotal += settleDelta;

      // food_use_logs に記録（use_amount=1回, amount_per_unit=固定金額）
      const { error: logError } = await supabase.from("food_use_logs").insert({
        owner,
        use_date: date,
        item_id: `fixed_${fi.name}`,
        item_name: fi.name,
        use_amount: 1,
        amount_per_unit: fi.amount,
        unit: "回",
        settle_delta: settleDelta,
      });
      if (logError) console.error("fixed log error:", logError);
    }

    // 通常食材（RPC）＋固定費の合計を1行だけ settle_entries に挿入
    // ※ RPC 側の settle_entries INSERT は削除済みであること
    const regularDelta = Number(rpcData.settleDeltaTotal ?? 0);
    const totalDelta = regularDelta + fixedDeltaTotal;
    if (totalDelta !== 0) {
      const { error: settleError } = await supabase.from("settle_entries").insert({
        date,
        delta: Math.round(totalDelta),
        source: "food.use",
        meta: { owner },
      });
      if (settleError) console.error("settle insert error:", settleError);
    }

    return NextResponse.json({ ok: true, ...rpcData });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
