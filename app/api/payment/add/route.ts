import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();

    const body = await req.json();
    const { category, date, amount, payer, forWhom, note } = body;

    if (!category || !date || !amount || !payer || !forWhom) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
    }

    // ① 家計簿
    const owner = payer === "なつ" ? "natsu" : "taka";

    const { error: kakeiboError } = await supabase
      .from("kakeibo_entries")
      .insert({
        owner,
        item: "割り勘用",
        date,
        amount: amt,
        category,
        expense: null,
        note: note ?? "",
        entry_type: "expense",
      });

    if (kakeiboError) throw kakeiboError;

    // ② 精算delta（あなたの仕様どおり）
    let delta = 0;
    if (payer === "なつ" && forWhom === "たか") delta = amt;
    if (payer === "たか" && forWhom === "なつ") delta = -amt;
    if (payer === "なつ" && forWhom === "共有") delta = amt * 0.5;
    if (payer === "たか" && forWhom === "共有") delta = -amt * 0.5;

    if (delta !== 0) {
      const { error: settleError } = await supabase
        .from("settle_entries")
        .insert({
          date,
          delta,
          source: "payment",
          meta: { payer, forWhom, category },
        });
      if (settleError) throw settleError;
    }

    return NextResponse.json({ success: true, delta });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
