import { redirect } from "next/navigation";

import { getServerSession } from "@/lib/auth/server";
import { resolveStudentHubAccess } from "@/lib/student/access";

export default async function ScriptureReviewPage() {
  const access = resolveStudentHubAccess(await getServerSession());

  if (!access.allowed) {
    return null;
  }

  if (access.role === "student") {
    redirect("/student");
  }

  redirect("/discipleship");
}
