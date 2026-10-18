import Link from "next/link";

const sections = [
  { href: "/trips", number: "01", title: "Los viajes", description: "Cada partido fuera de casa, un recuerdo que guardar." },
  { href: "/stadiums", number: "02", title: "Los estadios", description: "Gradas distintas. La misma forma de sentirlo." },
  { href: "/map", number: "03", title: "El mapa", description: "Un lugar para cada chincheta. Una historia detrás." },
];

export default function HomePage() {
  return (
    <div className="page-content">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-copy">
          <p className="eyebrow">Un archivo personal · Elche CF</p>
          <h1 id="home-title">Donde tú<br /><span>vayas.</span></h1>
          <p className="lead">Kilómetros, gradas y recuerdos siguiendo al Elche. La historia que hay detrás de cada chincheta.</p>
          <Link href="/trips" className="button-link">Explorar los viajes <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="cork-card" aria-hidden="true">
          <span className="card-topline">ELCHE AWAY <span>ARCHIVO PERSONAL</span></span>
          <div className="journey-art"><span className="route-line" /><span className="route-start" /><span className="route-pin" /></div>
          <p className="card-motto">Siempre contigo.<br /><span>También lejos de casa.</span></p>
          <span className="card-bottomline">FÚTBOL · CARRETERA · MEMORIA</span>
        </div>
      </section>
      <section className="archive-section" aria-labelledby="archive-title">
        <div className="section-heading">
          <h2 id="archive-title">Un archivo, muchas formas de recordarlo.</h2>
          <p>Explora los viajes, los estadios y las historias que hay detrás.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <Link href={section.href} key={section.href} className="section-card">
              <span className="card-number">{section.number}</span>
              <h3>{section.title}<span aria-hidden="true">↗</span></h3>
              <p>{section.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
