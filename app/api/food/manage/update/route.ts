export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const itemId = body?.item_id;

    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });
    if (!itemId) return NextResponse.json({ error: "item_id required" }, { status: 400 });

    const price = Number(body?.price);
    const volume = Number(body?.volume);
    const remain = Number(body?.remain);
    const note = body?.note ?? "";
    const name = body?.name ? String(body.name).trim() : null;
    const purchaseDate = body?.purchaseDate ? String(body.purchaseDate) : null;

    if (!Number.isFinite(price) || price <= 0)
      return NextResponse.json({ error: "price invalid" }, { status: 400 });

    if (!Number.isFinite(volume) || volume <= 0)
      return NextResponse.json({ error: "volume invalid" }, { status: 400 });

    if (!Number.isFinite(remain) || remain < 0)
      return NextResponse.json({ error: "remain invalid" }, { status: 400 });

    const amount_per_unit = price / volume;

    const updatePayload: Record<string, any> = {
      price,
      volume,
      remain,
      amount_per_unit,
      note,
    };
    if (name) updatePayload.name = name;
    if (purchaseDate) updatePayload.purchase_date = purchaseDate;

    const { error } = await supabase
      .from("food_items")
      .update(updatePayload)
      .eq("owner", owner)
      .eq("item_id", itemId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}