import Link from "next/link";

const navItems = [
  { href: "/student", label: "Home" },
  { href: "/student/scripture", label: "Scripture Hub" },
  { href: "/student/scripture/questions", label: "Small Group Questions" },
  { href: "/student/scripture/plans", label: "Reading Plans" },
  { href: "/student/scripture/review", label: "Review Queue" },
  { href: "/student/scripture/resources", label: "Resources" }
] as const;

type StudentShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    role: string;
  };
};

export function StudentShell({ children, user }: StudentShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <Link className="grid gap-1 text-inherit no-underline" href="/student">
              <span className="text-xs font-black uppercase tracking-[0.08em] text-[var(--primary)]">Lead Emergence</span>
              <span className="text-2xl font-black leading-tight">Student Portal</span>
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="pill blue">{user.role}</span>
              <span className="font-bold text-slate-700">{user.name}</span>
            </div>
          </div>
          <nav className="flex flex-wrap gap-2 pb-1" aria-label="Student navigation">
            {navItems.map((item) => (
              <Link
                className="inline-flex min-h-10 shrink-0 items-center rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-extrabold text-slate-700 no-underline hover:border-blue-300 hover:bg-blue-50"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
