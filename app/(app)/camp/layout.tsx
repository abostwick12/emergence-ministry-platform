import { CampShell } from "@/components/camp/camp-shell";

export default function CampLayout({ children }: { children: React.ReactNode }) {
  return <CampShell>{children}</CampShell>;
}
