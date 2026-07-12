import Link from "next/link";

const navItems = [
  { href: "/student", label: "Home" },
  { href: "/student/scripture/questions", label: "Ask" },
  { href: "/student/scripture/plans", label: "Plans" },
  { href: "/student/scripture/how-to-read", label: "How to Read" },
  { href: "/student/scripture/resources", label: "Big Story" }
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
    <div className="student-shell">
      <header className="student-shell-header">
        <div className="student-shell-header-inner">
          <div className="student-shell-topline">
            <div className="student-shell-brand">
              <Link href="/dashboard">Lead Emergence</Link>
              <Link href="/student">Student Portal</Link>
            </div>
            <div className="student-shell-profile">
              <span className="pill blue">{user.role}</span>
              <strong>{user.name}</strong>
            </div>
          </div>
          <nav className="student-shell-nav" aria-label="Student navigation">
            {navItems.map((item) => (
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
