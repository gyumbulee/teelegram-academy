import { NextRequest, NextResponse } from "next/server";
import { findExpiredAccess, markAccessExpired } from "@/lib/expiry";
import { removeUserFromChannel, sendTelegramMessage } from "@/lib/telegram";

// Meant to be hit once a day by a system cron job on the VPS (see README),
// not by a public scheduler — protected by a shared secret so no one else
// can trigger mass-removals.
//
// Each row is processed independently: if removing one user fails (e.g.
// the bot lost admin rights on that channel), it's logged and the sweep
// continues rather than aborting for everyone else.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await findExpiredAccess();

  let removed = 0;
  let failed = 0;

  for (const row of expired) {
    try {
      await removeUserFromChannel(row.telegram_channel_id, row.telegram_id);
      await markAccessExpired(row.channel_access_id);
      await sendTelegramMessage(
        row.telegram_id,
        `Your access to *${row.course_title}* has expired. Renew anytime by messaging the bot to purchase again.`,
      );
      removed++;
    } catch (err) {
      console.error(
        `Failed to expire channel_access ${row.channel_access_id} (course ${row.course_id}):`,
        err,
      );
      failed++;
    }
  }

  return NextResponse.json({ checked: expired.length, removed, failed });
}
