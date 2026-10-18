import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-content page-heading">
      <p className="eyebrow">404 / Fuera de ruta</p>
      <h1>No encontramos esta página</h1>
      <p className="lead">Puede que el enlace no sea correcto. El camino continúa desde el inicio.</p>
      <Link href="/" className="button-link">Volver al inicio</Link>
    </div>
  );
}
