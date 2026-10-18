import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <PageHeader title="Not found" kicker="404">
      That page isn&apos;t on the radar.{" "}
      <Link href="/" className="text-accent hover:underline">
        Back to the overview
      </Link>
      .
    </PageHeader>
  );
}
