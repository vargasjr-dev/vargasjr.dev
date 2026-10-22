import { redirect } from "next/navigation";

// Cases are the heart of Velcro — land there.
export default function VelcroPage() {
  redirect("/admin/velcro/cases");
}
