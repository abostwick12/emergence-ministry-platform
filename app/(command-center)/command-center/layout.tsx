import { redirect } from "next/navigation";
import "@/app/command-center-theme.css";
import { getServerSession } from "@/lib/auth/server";
import { isCommandCenterUser } from "@/lib/command-center/access";
import { CommandCenterShell } from "@/components/command-center/command-center-shell";

export default async function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  if (!isCommandCenterUser(session)) redirect("/dashboard");

  return <CommandCenterShell>{children}</CommandCenterShell>;
}
