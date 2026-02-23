export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function toDbOwner(o: string) {
  if (o === "なつ" || o === "natsu") return "natsu";
  if (o === "たか" || o === "taka") return "taka";
  return null;
}

// POST /api/kakeibo/add
// 収入として kakeibo_entries に記録する (entry_type='income', amount はマイナスで保存)
// body: { owner, category, date, amount, note }
export async function POST(req: Request) {
  try {
    const supabase = createAdminClient();
    const body = await req.json();

    const owner = toDbOwner(body?.owner);
    if (!owner) return NextResponse.json({ error: "owner invalid" }, { status: 400 });

    const category = String(body?.category ?? "").trim();
    const date = String(body?.date ?? "").trim();
    const note = String(body?.note ?? "");
    const amount = Number(body?.amount);

    if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });

    const { error } = await supabase.from("kakeibo_entries").insert({
      owner,
      item: category || "収入",
      date,
      amount: -amount, // 収入はマイナスで記録（後方互換）
      category,
      note,
      entry_type: "income",
    });

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
