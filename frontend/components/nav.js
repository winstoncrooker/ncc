/**
 * Shared Navigation Component
 * Injects navigation bar into all pages
 */

const NAV_HTML = `
<nav id="mainNav">
  <button class="hamburger" id="hamburger" aria-label="Menu">
    <span></span><span></span><span></span>
  </button>
  <div class="nav-links" id="navLinks">
    <a href="index.html">Home</a>
    <a href="stats.html">Stats</a>
    <a href="mycollection.html">My Collection</a>
    <a href="genre.html?genre=rock">Rock</a>
    <a href="genre.html?genre=blues">Blues</a>
    <a href="genre.html?genre=metal">Metal</a>
    <a href="genre.html?genre=pop">Pop</a>
    <a href="genre.html?genre=jazz">Jazz</a>
    <a href="genre.html?genre=soul">Soul</a>
    <a href="genre.html?genre=funk">Funk</a>
    <a href="genre.html?genre=country">Country</a>
    <a href="genre.html?genre=hiphop">Hip-Hop</a>
    <a href="genre.html?genre=folk">Folk</a>
    <a href="genre.html?genre=classical">Classical</a>
    <a href="genre.html?genre=experimental">Experimental</a>
    <a href="genre.html?genre=comedy">Comedy</a>
  </div>
</nav>
`;

function initNav() {
  // Insert nav at the start of body
  document.body.insertAdjacentHTML('afterbegin', NAV_HTML);

  // Setup hamburger menu
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      navLinks.classList.toggle('active');
      document.body.classList.toggle('menu-open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('nav')) {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.classList.remove('menu-open');
      }
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        document.body.classList.remove('menu-open');
      });
    });
  }

  // Highlight current page in nav
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const currentParams = new URLSearchParams(window.location.search);

  navLinks.querySelectorAll('a').forEach(link => {
    const linkHref = link.getAttribute('href');
    const linkUrl = new URL(linkHref, window.location.origin);
    const linkPage = linkUrl.pathname.split('/').pop();
    const linkParams = new URLSearchParams(linkUrl.search);

    if (linkPage === currentPage) {
      if (linkParams.get('genre') === currentParams.get('genre') || !linkParams.has('genre')) {
        link.classList.add('active');
      }
    }
  });
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initNav);
} else {
  initNav();
}
