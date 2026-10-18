import Link from "next/link";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  message: string;
};

export function EmptyState({ eyebrow, title, description, message }: EmptyStateProps) {
  return (
    <div className="page-content">
      <header className="page-heading">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lead">{description}</p>
      </header>
      <section className="empty-state" aria-label="Estado del archivo">
        <span className="pin-mark" aria-hidden="true" />
        <h2>La historia está por llegar</h2>
        <p>{message}</p>
        <Link href="/" className="text-link">Volver al inicio <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
