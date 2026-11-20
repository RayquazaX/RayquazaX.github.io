/* Progressive enhancements. The page reads fine with this file missing. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── email (assembled here so the address is not sitting in the HTML) ──────
  const mailOf = (el) => `${el.dataset.u}@${el.dataset.d}`;
  $$(".js-email").forEach((a) => {
    a.href = `mailto:${mailOf(a)}`;
    const t = $(".js-email-text", a);
    if (t) t.textContent = mailOf(a);
  });

  // ── theme (light unless the visitor chose dark) ──────────────────────────
  const toggleTheme = () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    if (next === "dark") root.dataset.theme = "dark";
    else delete root.dataset.theme;
    try { localStorage.setItem("theme", next); } catch (e) { /* private mode: stays for this visit */ }
  };
  $("#theme-toggle")?.addEventListener("click", toggleTheme);

  // ── typed tagline ────────────────────────────────────────────────────────
  const typed = $("#typed");
  if (typed && !reduced) {
    let phrases = [];
    try { phrases = JSON.parse(typed.dataset.phrases); } catch (e) { /* keep static text */ }
    if (phrases.length > 1) {
      let p = 0, i = phrases[0].length, del = true;
      const tick = () => {
        const full = phrases[p];
        i += del ? -1 : 1;
        typed.textContent = full.slice(0, i);
        let wait = del ? 24 : 46;
        if (!del && i === full.length) { del = true; wait = 2400; }
        else if (del && i === 0) { del = false; p = (p + 1) % phrases.length; wait = 320; }
        setTimeout(tick, wait);
      };
      setTimeout(tick, 2600);
    }
  }

  // ── reading progress ─────────────────────────────────────────────────────
  const bar = $("#progress");
  const onScroll = () => {
    const max = root.scrollHeight - innerHeight;
    bar.style.width = max > 0 ? `${Math.min(100, (scrollY / max) * 100)}%` : "0";
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ── scrollspy for the anchor bar ─────────────────────────────────────────
  const navLinks = $$(".anchors-scroll a");
  const byId = new Map(navLinks.map((a) => [a.hash.slice(1), a]));
  if ("IntersectionObserver" in window && navLinks.length) {
    const visible = new Set();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        const current = [...byId.keys()].find((id) => visible.has(id));
        navLinks.forEach((a) => a.classList.toggle("is-active", a === byId.get(current)));
        const active = byId.get(current);
        if (active) {
          const box = active.parentElement;
          const left = active.offsetLeft - box.offsetLeft;
          if (left < box.scrollLeft || left + active.offsetWidth > box.scrollLeft + box.clientWidth) {
            box.scrollTo({ left: left - 24, behavior: reduced ? "auto" : "smooth" });
          }
        }
      },
      { rootMargin: "-18% 0px -62% 0px" },
    );
    byId.forEach((_, id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  // ── news: show more ──────────────────────────────────────────────────────
  const more = $("#news-more");
  more?.addEventListener("click", () => {
    const open = more.getAttribute("aria-expanded") !== "true";
    $$(".news [data-more]").forEach((li) => (li.hidden = !open));
    more.setAttribute("aria-expanded", String(open));
    more.textContent = open ? "▴ Show less" : "▾ Show more news";
  });

  // ── publications: search, abstracts, BibTeX ──────────────────────────────
  const pubEls = $$(".pub");
  const search = $("#pub-search");
  const empty = $("#pub-empty");
  const applyPubs = () => {
    const q = (search?.value || "").trim().toLowerCase();
    let shown = 0;
    pubEls.forEach((el) => {
      const ok = !q || el.dataset.text.includes(q);
      el.hidden = !ok;
      if (ok) shown++;
    });
    $$(".pub-group").forEach((g) => { g.hidden = !g.querySelector(".pub:not([hidden])"); });
    if (empty) empty.hidden = shown > 0;
  };
  search?.addEventListener("input", applyPubs);

  $$(".abs-btn").forEach((b) =>
    b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", String(open));
      b.textContent = open ? "▴ Abstract" : "▾ Abstract";
      document.getElementById(b.getAttribute("aria-controls")).hidden = !open;
    }),
  );

  $$(".js-bib").forEach((b) =>
    b.addEventListener("click", async () => {
      const label = $("span", b);
      try {
        await navigator.clipboard.writeText(b.dataset.bib);
        label.textContent = "Copied";
      } catch (e) {
        // clipboard blocked (e.g. opened from file://): show it so it can be copied by hand
        window.prompt("Copy BibTeX:", b.dataset.bib);
        return;
      }
      b.classList.add("is-done");
      setTimeout(() => { label.textContent = "BibTeX"; b.classList.remove("is-done"); }, 1600);
    }),
  );

  // a hash that points at a paper the search has hidden should still land on it
  const revealTarget = () => {
    const el = location.hash.startsWith("#pub-") && document.getElementById(location.hash.slice(1));
    if (el && el.hidden) {
      if (search) search.value = "";
      applyPubs();
      el.scrollIntoView();
    }
  };
  addEventListener("hashchange", revealTarget);

  // ── paper map: highlight a paper's links, explain them underneath ────────
  const pm = $(".pm");
  if (pm) {
    const info = $("#pm-info");
    const nodes = $$(".pm-node", pm);
    const edges = $$(".pm-edge", pm);
    const nameOf = Object.fromEntries(nodes.map((n) => [n.dataset.id, n.dataset.name]));
    const line = (bold, rest) => {
      const s = document.createElement("span");
      const b = document.createElement("b");
      b.textContent = bold;
      s.append(b, rest);
      return s;
    };
    const clear = () => {
      pm.classList.remove("is-active");
      [...nodes, ...edges].forEach((el) => el.classList.remove("on"));
      info.textContent = info.dataset.default;
    };
    const focusNode = (node) => {
      const id = node.dataset.id;
      const mine = edges.filter((e) => e.dataset.a === id || e.dataset.b === id);
      const linked = new Set([id, ...mine.flatMap((e) => [e.dataset.a, e.dataset.b])]);
      pm.classList.add("is-active");
      nodes.forEach((n) => n.classList.toggle("on", linked.has(n.dataset.id)));
      edges.forEach((e) => e.classList.toggle("on", mine.includes(e)));
      info.replaceChildren(
        ...mine.map((e) => line(`${nameOf[id]} ↔ ${nameOf[e.dataset.a === id ? e.dataset.b : e.dataset.a]}`, `: ${e.dataset.why}`)),
      );
    };
    const focusEdge = (edge) => {
      pm.classList.add("is-active");
      nodes.forEach((n) => n.classList.toggle("on", n.dataset.id === edge.dataset.a || n.dataset.id === edge.dataset.b));
      edges.forEach((e) => e.classList.toggle("on", e === edge));
      info.replaceChildren(line(`${nameOf[edge.dataset.a]} ↔ ${nameOf[edge.dataset.b]}`, `: ${edge.dataset.why}`));
    };
    nodes.forEach((n) => {
      n.addEventListener("pointerenter", () => focusNode(n));
      n.addEventListener("focus", () => focusNode(n));
      n.addEventListener("pointerleave", clear);
      n.addEventListener("blur", clear);
    });
    edges.forEach((e) => {
      e.addEventListener("pointerenter", () => focusEdge(e));
      e.addEventListener("pointerleave", clear);
    });
  }

  // ── chart tooltips ───────────────────────────────────────────────────────
  const tip = $("#tip");
  const showTip = (bar) => {
    tip.replaceChildren();
    const b = document.createElement("b");
    b.textContent = Number(bar.dataset.v).toFixed(1);
    tip.append(b, ` · ${bar.dataset.s} · ${bar.dataset.g}`);
    const r = bar.getBoundingClientRect();
    tip.classList.add("is-on");
    const w = tip.offsetWidth;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
    tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
  };
  const hideTip = () => tip.classList.remove("is-on");
  $$(".bar").forEach((bar) => {
    bar.addEventListener("pointerenter", () => showTip(bar));
    bar.addEventListener("pointerleave", hideTip);
    bar.addEventListener("focus", () => showTip(bar));
    bar.addEventListener("blur", hideTip);
  });
  addEventListener("scroll", hideTip, { passive: true });

  // ── quick search (⌘K / Ctrl+K) ───────────────────────────────────────────
  const cmdk = $("#cmdk");
  const input = $("#cmdk-input");
  const list = $("#cmdk-list");
  let items = [];
  try { items = JSON.parse($("#cmdk-data").textContent); } catch (e) { /* palette stays empty */ }
  let results = [], sel = 0, lastFocus = null;

  const run = (it) => {
    closeCmdk();
    if (it.h === "theme") return toggleTheme();
    if (it.h === "mailto") { const a = $(".js-email"); if (a) location.href = a.href; return; }
    if (it.h.startsWith("#")) { location.hash = it.h; revealTarget(); return; }
    if (/^https?:/.test(it.h)) window.open(it.h, "_blank", "noopener");
    else location.href = it.h;
  };
  const render = () => {
    const q = input.value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    results = items.filter((it) => words.every((w) => `${it.t} ${it.s || ""} ${it.k}`.toLowerCase().includes(w)));
    sel = Math.min(sel, Math.max(0, results.length - 1));
    list.replaceChildren(
      ...(results.length
        ? results.map((it, i) => {
            const li = document.createElement("li");
            li.setAttribute("role", "option");
            li.setAttribute("aria-selected", String(i === sel));
            const s = document.createElement("span");
            s.textContent = it.t;
            const k = document.createElement("small");
            k.textContent = it.k;
            li.append(s, k);
            li.addEventListener("click", () => run(it));
            li.addEventListener("pointermove", () => { if (sel !== i) { sel = i; mark(); } });
            return li;
          })
        : [Object.assign(document.createElement("li"), { className: "none", textContent: "Nothing matches." })]),
    );
  };
  const mark = () => {
    [...list.children].forEach((li, i) => li.setAttribute("aria-selected", String(i === sel)));
    list.children[sel]?.scrollIntoView({ block: "nearest" });
  };
  const openCmdk = () => {
    lastFocus = document.activeElement;
    cmdk.classList.add("is-open");
    input.value = "";
    sel = 0;
    render();
    input.focus();
  };
  function closeCmdk() {
    cmdk.classList.remove("is-open");
    lastFocus?.focus?.();
  }
  $("#cmdk-open")?.addEventListener("click", openCmdk);
  cmdk.addEventListener("pointerdown", (e) => { if (e.target === cmdk) closeCmdk(); });
  input.addEventListener("input", () => { sel = 0; render(); });
  addEventListener("keydown", (e) => {
    const open = cmdk.classList.contains("is-open");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open ? closeCmdk() : openCmdk();
      return;
    }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); closeCmdk(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % Math.max(1, results.length); mark(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + results.length) % Math.max(1, results.length); mark(); }
    else if (e.key === "Enter" && results[sel]) { e.preventDefault(); run(results[sel]); }
    else if (e.key === "Tab") { e.preventDefault(); input.focus(); }
  });
  // show the right modifier key on the button
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
    const k = $("#cmdk-open span");
    if (k) k.textContent = "Ctrl K";
  }
})();
