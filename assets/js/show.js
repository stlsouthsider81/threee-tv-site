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

  function initDescToggle() {
    var toggle = document.getElementById('show-desc-toggle');
    var panel = document.getElementById('show-desc-panel');
    if (!toggle || !panel) return;

    var label = toggle.querySelector('.show-desc-toggle-label');

    toggle.addEventListener('click', function () {
      var isOpen = panel.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (label) label.textContent = isOpen ? 'Less info' : 'More info';
    });
  }

  // Highlights whichever schedule block is airing right now, computed in
  // the schedule's own timezone (not the visitor's), since the times are
  // authored against a fixed zone (e.g. America/Chicago) regardless of
  // where the page is viewed from.
  function initSchedule() {
    var list = document.querySelector('.show-schedule-list');
    if (!list) return;

    var timezone = list.getAttribute('data-timezone');
    var items = list.querySelectorAll('.show-schedule-item');

    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(new Date());

    var hour = 0;
    var minute = 0;
    parts.forEach(function (part) {
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    });
    var nowMinutes = hour * 60 + minute;

    items.forEach(function (item) {
      var start = parseInt(item.getAttribute('data-start'), 10);
      var end = parseInt(item.getAttribute('data-end'), 10);
      var isLive = nowMinutes >= start && nowMinutes < end;
      item.classList.toggle('is-live', isLive);
    });
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

    initDescToggle();
    initSchedule();
  });
})();
