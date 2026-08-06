function getSiteFooterHtml() {
    return `
<footer id="contacto" data-site-footer>
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="index.html" class="footer-brand-heading">
            <img src="assets/images/logo.png" alt="" class="footer-logo">
            <h3>ArtesaniaBrass</h3>
          </a>
          <p>Joyería artesanal en latón y cobre hecha a mano por Rosa Alonso.</p>
        </div>

        <div>
          <h3>Tienda</h3>
          <ul>
            <li><a href="index.html#productos">Productos</a></li>
            <li><a href="index.html#categorias">Categorías</a></li>
            <li><a href="cuidado.html">El cuidado de tu joya</a></li>
          </ul>
        </div>

        <div>
          <h3>Ayuda</h3>
          <ul>
            <li><a href="envios.html">Envíos</a></li>
            <li><a href="devoluciones.html">Devoluciones</a></li>
            <li><a href="faq.html">Preguntas frecuentes</a></li>
          </ul>
        </div>

        <div>
          <h3>Contacto</h3>
          <ul class="footer-contact">
            <li>
              <a href="mailto:info@artesaniabrass.es" class="footer-contact-link">
                <svg class="footer-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 2.2 8 5.2 8-5.2V8l-8 5.2L4 8v.2z"/>
                </svg>
                <span>info@artesaniabrass.es</span>
              </a>
            </li>
            <li>
              <a href="tel:+34610266411" class="footer-contact-link">
                <svg class="footer-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7.5 3.5c.4-.4 1-.5 1.5-.3l2.2 1c.5.2.8.7.8 1.2v2.2c0 .4-.2.8-.5 1.1L9.8 10.4c1.2 2.2 3 4 5.2 5.2l1.7-1.7c.3-.3.7-.5 1.1-.5h2.2c.5 0 1 .3 1.2.8l1 2.2c.2.5.1 1.1-.3 1.5l-1.5 1.5c-.4.4-1 .6-1.6.5C12.3 20.2 3.8 11.7 3 4.9c-.1-.6.1-1.2.5-1.6L7.5 3.5z"/>
                </svg>
                <span>+34 610 266 411</span>
              </a>
            </li>
            <li>
              <a href="https://www.instagram.com/artesania.brass/" target="_blank" rel="noopener noreferrer" class="footer-contact-link">
                <svg class="footer-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm5 4.5A4.5 4.5 0 1 0 16.5 12 4.5 4.5 0 0 0 12 7.5zm0 2A2.5 2.5 0 1 1 9.5 12 2.5 2.5 0 0 1 12 9.5zM17.8 6.2a1 1 0 1 0 1 1 1 1 0 0 0-1-1z"/>
                </svg>
                <span>@artesania.brass</span>
              </a>
            </li>
            <li>
              <a href="https://maps.google.com/?q=Coma-ruga,+Tarragona" target="_blank" rel="noopener noreferrer" class="footer-contact-link">
                <svg class="footer-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5z"/>
                </svg>
                <span>Coma-ruga, Tarragona</span>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <p>
          &copy; 2026 ArtesaniaBrass.
          <a href="aviso-legal.html">Aviso legal</a> ·
          <a href="privacidad.html">Privacidad</a> ·
          <a href="cookies.html">Cookies</a>
        </p>
      </div>
    </div>
  </footer>
`.trim();
}

function renderSiteFooter() {
    const html = getSiteFooterHtml();
    const existing = document.querySelector("footer#contacto, footer[data-site-footer], #site-footer");

    if (existing) {
        existing.outerHTML = html;
        return;
    }

    document.body.insertAdjacentHTML("beforeend", html);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSiteFooter);
} else {
    renderSiteFooter();
}
