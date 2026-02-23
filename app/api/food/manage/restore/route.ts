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
    const itemId = body?.itemId;
    const remain = body?.remain !== undefined ? Number(body.remain) : null;

    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });
    if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
    if (remain !== null && (!Number.isFinite(remain) || remain < 0))
      return NextResponse.json({ error: "remain invalid" }, { status: 400 });

    const { data: item, error } = await supabase
      .from("food_deleted")
      .select("*")
      .eq("owner", owner)
      .eq("item_id", itemId)
      .single();

    if (error) throw error;

    await supabase.from("food_items").insert({
      owner: item.owner,
      item_id: item.item_id,
      name: item.name,
      volume: item.volume,
      price: item.price,
      unit: item.unit,
      amount_per_unit: item.amount_per_unit,
      remain: remain !== null ? remain : item.volume,
      purchase_date: item.purchase_date,
      note: item.note,
    });

    await supabase
      .from("food_deleted")
      .delete()
      .eq("owner", owner)
      .eq("item_id", itemId);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
