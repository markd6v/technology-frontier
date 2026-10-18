import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { isJobName, runJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel Hobby ceiling; ingest stops itself at 240 s.

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`; GitHub Actions sends POST.
async function handle(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { name } = await params;
  if (!isJobName(name)) return NextResponse.json({ error: `unknown job ${name}` }, { status: 404 });

  const force = req.nextUrl.searchParams.get("force") === "1";
  const trigger = req.headers.get("user-agent")?.includes("vercel-cron") ? "vercel-cron" : "http";
  const result = await runJob(name, trigger, { force });
  if (!result.skipped) {
    revalidateTag("items");
    revalidateTag("sources");
  }
  return NextResponse.json(result);
}

export { handle as GET, handle as POST };
