import Link from "next/link";

const navItems = [
  { href: "/student", label: "Home" },
  { href: "/student/scripture/questions", label: "Ask" },
  { href: "/student/scripture/plans", label: "Plans" },
  { href: "/student/scripture/resources", label: "Resources" }
] as const;

const leaderNavItem = { href: "/student/scripture/review", label: "Leader Review" } as const;

type StudentShellProps = {
  children: React.ReactNode;
  user: {
    name: string;
    role: string;
  };
};

export function StudentShell({ children, user }: StudentShellProps) {
  const items = user.role === "admin" || user.role === "leader" ? [...navItems, leaderNavItem] : navItems;

  return (
    <div className="student-shell">
      <header className="student-shell-header">
        <div className="student-shell-header-inner">
          <div className="student-shell-topline">
            <Link className="student-shell-brand" href="/student">
              <span>Lead Emergence</span>
              <strong>Student Portal</strong>
            </Link>
            <div className="student-shell-profile">
              <span className="pill blue">{user.role}</span>
              <strong>{user.name}</strong>
            </div>
          </div>
          <nav className="student-shell-nav" aria-label="Student navigation">
            {items.map((item) => (
              <Link
                className="student-shell-nav-link"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="student-shell-main">{children}</main>
    </div>
  );
}
