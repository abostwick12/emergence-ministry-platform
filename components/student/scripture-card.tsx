import Link from "next/link";

type ScriptureCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  meta?: string[];
  children?: React.ReactNode;
};

export function ScriptureCard({ eyebrow, title, description, href, actionLabel, meta = [], children }: ScriptureCardProps) {
  const body = (
    <>
      <div className="grid gap-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 className="scripture-card-title">{title}</h2>
        <p className="scripture-card-copy">{description}</p>
      </div>
      {meta.length ? (
        <div className="flex flex-wrap gap-2">
          {meta.map((item) => (
            <span className="pill" key={item}>
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {children}
      {href && actionLabel ? (
        <span className="button primary w-fit" aria-hidden="true">
          {actionLabel}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link className="card grid gap-4 text-inherit no-underline transition scripture-card-link" href={href}>
        {body}
      </Link>
    );
  }

  return <article className="card grid gap-4">{body}</article>;
}
