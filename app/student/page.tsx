import { inactiveFutureRoles } from "@/lib/authorization";

export default function StudentPlaceholderPage() {
  return (
    <main className="main">
      <section className="panel">
        <p className="eyebrow">Route Guard Placeholder</p>
        <h1 className="title">Student View</h1>
        <p className="muted">
          The {inactiveFutureRoles.includes("student") ? "student" : "requested"} role exists in the authorization model,
          but no working Student screens are exposed in MVP 1.
        </p>
      </section>
    </main>
  );
}
