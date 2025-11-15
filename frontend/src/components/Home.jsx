import React from 'react';

function Home() {
  return (
    <div className="home-hero">
      <div className="home-hero-inner">
        <div className="home-hero-video-wrapper">
          <video autoPlay muted loop playsInline>
            {/* tutaj używasz swojego pionowego filmu */}
            <source src="/materials/running.mp4" type="video/mp4" />
          </video>
        </div>

        <section>
          <h2>Witaj w aplikacji do analizy treningów biegowych!</h2>
          <p>
            Monitoruj swoje postępy, analizuj statystyki i dziel się wynikami z innymi biegaczami
          </p>
        </section>
      </div>
    </div>
  );
}

export default Home;
