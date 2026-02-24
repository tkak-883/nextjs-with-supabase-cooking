import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toDbOwner(o: string) {
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const owner = toDbOwner(body?.owner);
    const itemIds: string[] = body?.itemIds ?? [];

    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });
    if (!Array.isArray(itemIds) || itemIds.length === 0)
      return NextResponse.json({ error: "itemIds required" }, { status: 400 });

    for (const id of itemIds) {
      const { data: item, error: e1 } = await supabase
        .from("food_items")
        .select("*")
        .eq("owner", owner)
        .eq("item_id", id)
        .single();

      if (e1) throw e1;

      const { error: e2 } = await supabase.from("food_deleted").insert({
        owner: item.owner,
        item_id: item.item_id,
        name: item.name,
        price: item.price,
        volume: item.volume,
        unit: item.unit,
        amount_per_unit: item.amount_per_unit,
        purchase_date: item.purchase_date,
        month_key: item.month_key,
        note: item.note,
        delete_date: new Date().toISOString(),
      });
      if (e2) throw e2;

      const { error: e3 } = await supabase
        .from("food_items")
        .delete()
        .eq("owner", owner)
        .eq("item_id", id);
      if (e3) throw e3;
    }

    // 30日掃除
    await supabase
      .from("food_deleted")
      .delete()
      .eq("owner", owner)
      .lte("delete_date", new Date(Date.now() - 30 * 86400000).toISOString());

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
