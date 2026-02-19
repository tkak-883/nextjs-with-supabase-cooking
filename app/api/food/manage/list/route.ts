export const runtime = "nodejs";
export const dynamic = "force-dynamic";


import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toDbOwner(ownerParam: string) {
  const o = (ownerParam || "").trim();
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

function toMonthKey(dateStr: string) {
  // "YYYY-MM-DD" -> "YYYY-MM"
  if (!dateStr) return "";
  return String(dateStr).slice(0, 7);
}

export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const url = new URL(req.url);

    const ownerParam = url.searchParams.get("owner") ?? "";
    const owner = toDbOwner(ownerParam);
    if (!owner) {
      return NextResponse.json({ error: "owner invalid" }, { status: 400 });
    }

    const monthKey = (url.searchParams.get("monthKey") ?? "").trim(); // "YYYY-MM" or ""

    // --- 現役 items ---
    const q1 = supabase
      .from("food_items")
      .select("name,item_id,volume,price,unit,amount_per_unit,remain,purchase_date,note")
      .eq("owner", owner)
      .order("purchase_date", { ascending: false });

    const { data: itemsRaw, error: e1 } = await q1;
    if (e1) throw e1;

    const itemsAll = (itemsRaw ?? []).map((r) => ({
      name: r.name,
      item_id: r.item_id,
      volume: r.volume,
      price: r.price,
      unit: r.unit,
      amountPerUnit: r.amount_per_unit,
      remain: r.remain,
      purchaseDate: r.purchase_date,
      note: r.note ?? "",
      monthKey: toMonthKey(r.purchase_date),
    }));

    const items = monthKey ? itemsAll.filter((x) => x.monthKey === monthKey) : itemsAll;

    // --- 最近削除 deleted ---
    const { data: delRaw, error: e2 } = await supabase
      .from("food_deleted")
      .select("name,item_id,volume,price,unit,amount_per_unit,purchase_date,delete_date,note")
      .eq("owner", owner)
      .order("delete_date", { ascending: false });

    if (e2) throw e2;

    const deletedAll = (delRaw ?? []).map((r) => ({
      name: r.name,
      item_id: r.item_id,
      volume: r.volume,
      price: r.price,
      unit: r.unit,
      amountPerUnit: r.amount_per_unit,
      purchaseDate: r.purchase_date,
      deleteDate: r.delete_date,
      note: r.note ?? "",
      monthKey: toMonthKey(r.purchase_date),
    }));

    const deleted = monthKey ? deletedAll.filter((x) => x.monthKey === monthKey) : deletedAll;

    // --- months（items+deletedのpurchase_dateから抽出） ---
    const monthsSet = new Set<string>();
    for (const x of [...itemsAll, ...deletedAll]) {
      if (x.monthKey) monthsSet.add(x.monthKey);
    }
    const months = [...monthsSet].sort().reverse();

    return NextResponse.json({
      ok: true,
      owner: ownerParam,
      owner_db: owner,
      monthKey,
      months,
      items,
      deleted,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
