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

    const { data, error } = await supabase.rpc("food_use", {
      p_owner: owner,
      p_date: date,
      p_rows: cleanRows, // jsonb
    });

    if (error) throw error;

    return NextResponse.json({ ok: true, ...data });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
