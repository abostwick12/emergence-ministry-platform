import { inactiveFutureRoles } from "@/lib/authorization";

export default function ParentPlaceholderPage() {
  return (
    <main className="main">
      <section className="panel">
        <p className="eyebrow">Route Guard Placeholder</p>
        <h1 className="title">Parent View</h1>
        <p className="muted">
          The {inactiveFutureRoles.includes("parent") ? "parent" : "requested"} role exists in the authorization model,
          but no working Parent screens are exposed in MVP 1.
        </p>
      </section>
    </main>
  );
}
