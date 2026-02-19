import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date();
  const month = `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("settlements")
    .select("delta")
    .eq("month", month);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total =
    data?.reduce((sum, row) => sum + Number(row.delta), 0) ?? 0;

  return NextResponse.json({
    month,
    total,
    message:
      total > 0
        ? `たかがなつに ${total} 円返す`
        : total < 0
        ? `なつがたかに ${Math.abs(total)} 円返す`
        : "貸し借りなし！",
  });
}
