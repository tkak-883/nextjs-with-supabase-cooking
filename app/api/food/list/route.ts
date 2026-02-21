export const runtime = "nodejs";
export const dynamic = "force-dynamic";


import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/food/list?owner=なつ   or owner=natsu
export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const url = new URL(req.url);

    const ownerParam = (url.searchParams.get("owner") || "").trim();
    if (!ownerParam) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }

    // 受け付ける値：なつ/たか or natsu/taka
    const owner =
      ownerParam === "なつ" || ownerParam === "natsu" ? "natsu" :
      ownerParam === "たか" || ownerParam === "taka"  ? "taka"  :
      null;

    if (!owner) {
      return NextResponse.json(
        { error: `invalid owner: ${ownerParam} (use なつ/たか or natsu/taka)` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("food_items")
      .select("name,item_id,amount_per_unit,remain,unit")
      .eq("owner", owner)
      .order("purchase_date", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      owner: ownerParam,        // UI用（入力のまま返す）
      owner_db: owner,          // デバッグ用
      items: (data ?? []).map((r) => ({
        name: r.name,
        item_id: r.item_id,
        unit: r.unit,
        remain: r.remain,
        amountPerUnit: r.amount_per_unit,
      })),
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
