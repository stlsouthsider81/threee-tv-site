// Schedule API client: powers the homepage "now playing" overlay and the
// show pages' Daily Lineup. Contract: https://api-stream.threee.tv/v1/...
// The API sets proper Cache-Control (+ stale-while-revalidate); never add
// cache-busters.
(function () {
  var API = 'https://api-stream.threee.tv';
  var CHANNEL = 'main';

  // ---------- Homepage: now-playing overlay ----------
  //
  // The one rule: ask the API what is on at the instant of the frame on
  // screen (tv3PlayingDate, from EXT-X-PROGRAM-DATE-TIME) — never at
  // Date.now(). A viewer sits 12–16s behind live, so wall-clock lookups
  // flip the title early at every programme boundary.
  function initNowPlaying() {
    var overlay = document.getElementById('now-playing');
    var video = document.getElementById('video');
    if (!overlay || !video || typeof window.tv3PlayingDate !== 'function') return;

    var kickerEl = document.getElementById('now-playing-kicker');
    var titleEl = document.getElementById('now-playing-title');
    var subEl = document.getElementById('now-playing-sub');
    var barEl = document.getElementById('now-playing-progress');
    var fillEl = document.getElementById('now-playing-progress-fill');

    var refreshTimer;
    var current = null;
    var lastShownTitle = null;

    // Progress is computed locally from the on-screen instant and animated
    // every second; the API is only consulted at programme boundaries.
    function renderProgress() {
      var at = window.tv3PlayingDate();
      if (!current || !at) {
        fillEl.style.width = '0%';
        return;
      }
      var start = new Date(current.starts_at).getTime();
      var span = new Date(current.ends_at).getTime() - start;
      var pct = span > 0 ? ((at.getTime() - start) / span) * 100 : 0;
      fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
    }

    function render(block, cur, next) {
      current = cur;
      if (!cur && !next) {
        overlay.classList.add('hidden');
        return;
      }
      overlay.classList.remove('hidden');

      if (cur) {
        // The guide often collapses a block into one entry whose title IS
        // the block name; don't echo the same text in the kicker.
        var kicker = cur.block || block;
        kickerEl.textContent = kicker && kicker !== cur.title ? kicker : 'Now Playing';
        titleEl.textContent = cur.title || '';

        var sub = '';
        if (cur.episode_title) {
          sub = cur.season_number && cur.episode_number
            ? 'S' + cur.season_number + 'E' + cur.episode_number + ' · ' + cur.episode_title
            : cur.episode_title;
        }
        subEl.textContent = sub;
        subEl.classList.toggle('hidden', !sub);
        barEl.classList.remove('hidden');
      } else {
        // Guide gap: the top-level block still resolves from the instant
        // even when `current` is null — lead with it.
        kickerEl.textContent = block || 'TV3';
        titleEl.textContent = next ? 'Up next: ' + next.title : '';
        subEl.classList.add('hidden');
        barEl.classList.add('hidden');
      }
      renderProgress();

      // Reveal the overlay (and the other controls) whenever the programme
      // name first arrives or changes, then let it fade as usual.
      if (titleEl.textContent && titleEl.textContent !== lastShownTitle) {
        lastShownTitle = titleEl.textContent;
        if (typeof window.tv3ShowControls === 'function') window.tv3ShowControls();
      }
    }

    function scheduleRefresh(ms) {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, ms);
    }

    function refresh() {
      clearTimeout(refreshTimer);
      var at = window.tv3PlayingDate();
      // Null until the first playlist with PDT parses; retry rather than
      // falling back to Date.now(), which reintroduces the boundary bug.
      if (!at) return scheduleRefresh(1000);

      fetch(API + '/v1/channels/' + CHANNEL + '/now?at=' + at.toISOString())
        .then(function (res) {
          // 503 "starting" and transient failures alike: retry with backoff.
          if (!res.ok) throw new Error('http ' + res.status);
          return res.json();
        })
        .then(function (data) {
          render(data.block, data.current, data.next);
          // Re-ask AT the boundary: that call returns the old `next` as the
          // new `current`, so the handoff lands exactly on the frame.
          var now = window.tv3PlayingDate();
          var msUntil = data.current && now
            ? new Date(data.current.ends_at) - now
            : 30000;
          scheduleRefresh(Math.max(msUntil, 1000) + 500);
        })
        .catch(function () {
          scheduleRefresh(30000);
        });
    }

    // DVR seeks move the on-screen instant; background tabs throttle timers.
    video.addEventListener('seeked', refresh);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') refresh();
    });
    setInterval(renderProgress, 1000);
    refresh();
  }

  // ---------- Show pages: Daily Lineup from the API ----------
  //
  // Progressive enhancement: the server-rendered front-matter lineup stays
  // as the fallback; on success we replace its items with live guide data.
  // No video on these pages, so wall-clock `at` is correct here.
  function initLineup() {
    var list = document.querySelector('.show-schedule-list');
    if (!list || document.getElementById('now-playing')) return;

    var timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: 'numeric' });
    var dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });

    function timeLabel(startIso, endIso, now) {
      var start = new Date(startIso);
      var end = new Date(endIso);
      var label = timeFmt.format(start) + '–' + timeFmt.format(end);
      if (start.toDateString() !== now.toDateString()) {
        label = dayFmt.format(start) + ' ' + label;
      }
      return label;
    }

    fetch(API + '/v1/channels/' + CHANNEL + '/schedule?at=' + new Date().toISOString() + '&limit=12')
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data.programmes || !data.programmes.length) return;
        var now = new Date();

        var items = data.programmes.map(function (p) {
          var li = document.createElement('li');
          li.className = 'show-schedule-item';
          if (new Date(p.starts_at) <= now && now < new Date(p.ends_at)) {
            li.classList.add('is-live');
          }

          var time = document.createElement('span');
          time.className = 'show-schedule-time';
          time.textContent = timeLabel(p.starts_at, p.ends_at, now);

          var info = document.createElement('span');
          info.className = 'show-schedule-info';
          var title = document.createElement('span');
          title.className = 'show-schedule-title';
          title.textContent = p.title || p.block || '';
          info.appendChild(title);
          if (p.block && p.block !== p.title) {
            var content = document.createElement('span');
            content.className = 'show-schedule-content';
            content.textContent = p.block;
            info.appendChild(content);
          }

          var live = document.createElement('span');
          live.className = 'show-schedule-live';
          live.textContent = 'On now';

          li.appendChild(time);
          li.appendChild(info);
          li.appendChild(live);
          return li;
        });

        list.textContent = '';
        items.forEach(function (li) { list.appendChild(li); });

        var tz = document.querySelector('.show-schedule-tz');
        if (tz) tz.textContent = 'All times local';
      })
      .catch(function () {
        // Keep the static front-matter lineup untouched.
      });
  }

  function init() {
    initNowPlaying();
    initLineup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
