import Link from "next/link";

const scriptureTabs = [
  { href: "/student/scripture/questions", label: "Questions", id: "questions" },
  { href: "/student/scripture/plans", label: "Reading Plans", id: "plans" },
  { href: "/student/scripture/how-to-read", label: "How to Read", id: "how-to-read" },
  { href: "/student/scripture/resources", label: "Resources", id: "resources" }
] as const;

type StudentScriptureTab = (typeof scriptureTabs)[number]["id"];

type StudentScriptureTabsProps = {
  active: StudentScriptureTab;
};

export function StudentScriptureTabs({ active }: StudentScriptureTabsProps) {
  return (
    <nav className="student-scripture-tabs" aria-label="Student Scripture Hub sections">
      {scriptureTabs.map((tab) => (
        <Link className="student-scripture-tab" href={tab.href} aria-current={active === tab.id ? "page" : undefined} key={tab.id}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
