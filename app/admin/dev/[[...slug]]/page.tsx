import { redirect } from "next/navigation";
import { CadetDev } from "./cadet-dev";

export default async function DevPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  if (!slug?.length) redirect("/admin/dev/assistant/");
  return <CadetDev />;
}
