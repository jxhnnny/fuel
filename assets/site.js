'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const nav = $('.nav');
  const toggle = $('#navToggle');
  const links = $('#navLinks');
  const mobile = matchMedia('(max-width: 1000px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const background = [$('.utility'), $('main'), $('footer')];
  let menuOpen = false;

  function setMenu(open, restoreFocus = true) {
    menuOpen = open && mobile.matches;
    document.documentElement.style.setProperty('--menu-top', `${nav.getBoundingClientRect().bottom}px`);
    toggle.setAttribute('aria-expanded', String(menuOpen));
    toggle.setAttribute('aria-label', menuOpen ? 'Close menu' : 'Open menu');
    links.classList.toggle('open', menuOpen);
    document.body.classList.toggle('menu-open', menuOpen);
    background.forEach(el => { el.inert = menuOpen; });
    if (menuOpen) links.querySelector('a').focus();
    else if (restoreFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => setMenu(!menuOpen));
  links.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link || !menuOpen) return;
    setMenu(false, false);
    const target = document.querySelector(link.getAttribute('href'));
    target?.setAttribute('tabindex', '-1');
    target?.focus({ preventScroll: true });
  });
  nav.addEventListener('keydown', event => {
    if (!menuOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); }
    if (event.key === 'Tab') {
      const focusable = [...nav.querySelectorAll('a,button')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  mobile.addEventListener('change', () => { if (!mobile.matches) setMenu(false, false); });
  window.addEventListener('resize', () => {
    if (menuOpen) document.documentElement.style.setProperty('--menu-top', `${nav.getBoundingClientRect().bottom}px`);
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => nav.classList.toggle('scrolled', !entry.isIntersecting)).observe($('.utility'));
    const navObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id === 'mission' ? 'about' : entry.target.id;
        links.querySelectorAll('a').forEach(link => {
          if (link.hash === `#${id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 });
    document.querySelectorAll('main > [id]').forEach(section => navObserver.observe(section));
    const reveal = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      if (!reduced.matches) entry.target.classList.add('is-revealed');
      reveal.unobserve(entry.target);
    }), { threshold: 0.12 });
    document.querySelectorAll('.about-photo,.mission-head,.svc-top,.ben-photo,.tracker-head,.team-head,.contact h2').forEach(el => reveal.observe(el));
  }

  $('#year').textContent = new Date().getFullYear();
  document.querySelectorAll('[data-product]').forEach(link => link.addEventListener('click', () => {
    $('#product').selectedIndex = Number(link.dataset.product);
  }));

  // Frontend email handoff only: never claim a request has been delivered.
  const form = $('#quoteForm');
  const status = $('#formStatus');
  const submit = form.querySelector('button[type=submit]');
  submit.disabled = false;
  const fields = [$('#name'), $('#email')];
  fields.forEach(field => {
    const error = document.createElement('span');
    error.className = 'field-error';
    error.id = `${field.id}Error`;
    error.hidden = true;
    field.after(error);
    field.addEventListener('input', () => {
      if (field.hasAttribute('aria-invalid')) validate(field);
      status.textContent = '';
      $('#emailFallback').hidden = true;
    });
  });
  function validate(field) {
    const empty = !field.value.trim();
    const message = empty ? `Please enter your ${field.id === 'name' ? 'full name' : 'email address'}.`
      : !field.validity.valid ? 'Please enter a valid email address, such as you@company.co.zw.' : '';
    const error = $(`#${field.id}Error`);
    error.textContent = message;
    error.hidden = !message;
    if (message) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', error.id); }
    else { field.removeAttribute('aria-invalid'); field.removeAttribute('aria-describedby'); }
    return !message;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const valid = fields.map(validate);
    if (valid.includes(false)) {
      status.textContent = 'Please check the highlighted fields.';
      fields[valid.indexOf(false)].focus();
      return;
    }
    const product = $('#product').value;
    const body = `Name: ${$('#name').value.trim()}\nPhone: ${$('#phone').value.trim()}\nEmail: ${$('#email').value.trim()}\nProduct needed: ${product}\n\nDetails:\n${$('#message').value.trim()}`;
    const mailto = `mailto:omakenergy1@gmail.com?subject=${encodeURIComponent('Fuel supply enquiry, ' + product)}&body=${encodeURIComponent(body)}`;
    const fallback = $('#emailFallback');
    fallback.href = mailto;
    fallback.hidden = false;
    submit.disabled = true;
    submit.textContent = 'Preparing your email…';
    status.textContent = 'Your email draft is ready. Complete and send it in your email app. Nothing has been submitted on this website. If your app does not open, use the email link below or call us.';
    window.location.href = mailto;
    window.setTimeout(() => {
      submit.disabled = false;
      submit.textContent = 'Send request →';
    }, 900);
  });
})();
