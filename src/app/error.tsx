"use client";

export default function ArchiveError({ reset }: { reset: () => void }) {
  return (
    <div className="page-content page-heading" role="alert">
      <p className="eyebrow">El archivo</p><h1>No podemos cargar esta página</h1>
      <p className="lead">El archivo no está disponible en este momento. Inténtalo de nuevo en unos instantes.</p>
      <button onClick={reset} className="button-link">Volver a intentar</button>
    </div>
  );
}
