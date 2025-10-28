import React from 'react';

function Social() {
  return (
    <section>
      <h2>Społeczność biegaczy</h2>
      <form>
        <textarea placeholder="Napisz coś..." required></textarea>
        <button type="submit">Dodaj post</button>
      </form>
      {/* Tu będą posty */}
    </section>
  );
}

export default Social;
