(function () {
  function pushClickEvent(slug) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'show_cta_click', show_slug: slug });
  }

  // Opt-in only: a show page must set `deep_link_scheme` in front matter
  // (rendered as data-deep-link) before this runs. Until the app registers
  // the scheme, attempting it unconditionally triggers a native
  // "Cannot Open Page" alert on iOS Safari on every tap.
  function attemptDeepLink(event, scheme, fallbackUrl) {
    event.preventDefault();

    var fallbackTimer = setTimeout(function () {
      if (!document.hidden) {
        window.location.href = fallbackUrl;
      }
    }, 1200);

    function clearFallback() {
      clearTimeout(fallbackTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', clearFallback);
    }

    function onVisibilityChange() {
      if (document.hidden) clearFallback();
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', clearFallback);

    // Must run synchronously within the click handler, or WebKit treats
    // the navigation as non-user-initiated and blocks it.
    window.location.href = scheme;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var ctas = document.querySelectorAll('.show-cta');
    ctas.forEach(function (cta) {
      cta.addEventListener('click', function (event) {
        pushClickEvent(cta.getAttribute('data-show-slug'));

        var scheme = cta.getAttribute('data-deep-link');
        if (scheme) {
          attemptDeepLink(event, scheme, cta.href);
        }
        // Otherwise let the normal App Store link navigate as-is.
      });
    });
  });
})();
