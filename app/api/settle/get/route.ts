import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/settle/get?month=2026-02
// month省略時は当月
export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();

    const url = new URL(req.url);
    const month = url.searchParams.get("month") ?? toMonthKey_(new Date()); // "YYYY-MM"

    const [yStr, mStr] = month.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return NextResponse.json({ error: "invalid month. use YYYY-MM" }, { status: 400 });
    }

    // 月の範囲 [start, end)
    const start = `${yStr}-${String(m).padStart(2, "0")}-01`;
    const endDate = new Date(y, m, 1); // JSは月が0-index、ここは「次月の1日」になる
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;

    // settle_entriesのdeltaを当月分合計
    const { data, error } = await supabase
      .from("settle_entries")
      .select("delta")
      .gte("date", start)
      .lt("date", end);

    if (error) throw error;

    const totalRaw = (data ?? []).reduce((s, r) => s + Number(r.delta), 0);

    // スプシのB2 = ROUND(SUM(A2:A),0) 相当
    const total = Math.round(totalRaw);

    let message = "貸し借りなし！";
    if (total > 0) message = `たかがなつに ${total} 円返す`;
    else if (total < 0) message = `なつがたかに ${Math.abs(total)} 円返す`;

    return NextResponse.json({ ok: true, month, total, message });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

function toMonthKey_(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
