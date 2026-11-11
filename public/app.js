/* Bookshelf sandbox UI. Plain JavaScript, no framework. */
(function () {
  'use strict';

  const CONFIG = window.BOOKSHELF_CONFIG || { revision: 1 };
  const TOKEN_KEY = 'bookshelf.token';
  const ROLE_KEY = 'bookshelf.role';
  const EMAIL_KEY = 'bookshelf.email';

  // ---------- language ----------

  function readCookie(name) {
    const found = document.cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
    return found ? decodeURIComponent(found.slice(name.length + 1)) : null;
  }

  const params = new URLSearchParams(location.search);
  const lang = ['en', 'uk'].includes(params.get('lang'))
    ? params.get('lang')
    : ['en', 'uk'].includes(readCookie('lang')) ? readCookie('lang') : 'en';
  document.documentElement.lang = lang;

  let messages = {};
  let fallback = {};
  const warned = new Set();

  async function loadMessages() {
    const [own, en] = await Promise.all([
      fetch(`/i18n/${lang}.json`).then((r) => r.json()),
      lang === 'en' ? Promise.resolve(null) : fetch('/i18n/en.json').then((r) => r.json()),
    ]);
    messages = own;
    fallback = en || own;
  }

  function t(key, vars) {
    let text = messages[key];
    if (text === undefined) {
      if (!warned.has(key)) {
        console.warn(`i18n: missing key "${key}" for lang=${lang}, falling back to en`);
        warned.add(key);
      }
      text = fallback[key];
    }
    if (text === undefined) return key;
    if (typeof text === 'object') text = text.other || Object.values(text)[0];
    return String(text).replace(/\{(\w+)\}/g, (_, name) => (vars && name in vars ? vars[name] : `{${name}}`));
  }

  function translatePage(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    (root || document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPlaceholder);
    });
  }

  function setLanguage(next) {
    document.cookie = `lang=${next}; path=/; SameSite=Lax`;
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    location.href = url.toString();
  }

  // ---------- money ----------

  function money(cents) {
    return (cents / 100).toFixed(2);
  }

  // ---------- session and API ----------

  function token() {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  function saveSession(session, email) {
    sessionStorage.setItem(TOKEN_KEY, session.token);
    sessionStorage.setItem(ROLE_KEY, session.role);
    if (email) sessionStorage.setItem(EMAIL_KEY, email);
    else sessionStorage.removeItem(EMAIL_KEY);
  }

  function clearSession() {
    [TOKEN_KEY, ROLE_KEY, EMAIL_KEY].forEach((k) => sessionStorage.removeItem(k));
  }

  class ApiError extends Error {
    constructor(status, body) {
      super((body && body.error && body.error.message) || `HTTP ${status}`);
      this.status = status;
      this.code = body && body.error && body.error.code;
      this.details = body && body.error && body.error.details;
    }
  }

  async function api(path, options) {
    const opts = options || {};
    const headers = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth !== false && token()) headers.Authorization = `Bearer ${token()}`;
    const response = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const body = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(response.status, body);
    return body;
  }

  async function startGuest() {
    const session = await api('/api/auth/guest', { method: 'POST', auth: false });
    saveSession(session, null);
    return session;
  }

  async function ensureSession() {
    if (!token()) await startGuest();
  }

  // Calls the API with a session. Starts a guest session when there is none,
  // or when the server forgot the old one (for example after a restart).
  async function withSession(path, options) {
    await ensureSession();
    try {
      return await api(path, options);
    } catch (err) {
      if (err.status !== 401) throw err;
      clearSession();
      await startGuest();
      return api(path, options);
    }
  }

  // ---------- header and cart badge ----------

  let badgeRequest = 0;

  function setBadge(count) {
    const badge = document.querySelector('[data-testid="cart-count"]');
    if (badge) badge.textContent = String(count);
  }

  async function refreshBadge() {
    const mine = ++badgeRequest;
    if (!token()) {
      setBadge(0);
      return;
    }
    try {
      const cart = await api('/api/cart');
      if (mine === badgeRequest) setBadge(cart.itemCount);
    } catch (err) {
      if (mine === badgeRequest) setBadge(0);
    }
  }

  function renderHeader() {
    const header = document.getElementById('site-header');
    if (!header) return;
    const who = sessionStorage.getItem(EMAIL_KEY) || (sessionStorage.getItem(ROLE_KEY) === 'guest' ? t('nav.guest') : '');
    header.innerHTML = `
      <a class="logo" href="/">Bookshelf</a>
      <nav aria-label="Main">
        <span class="lang-switch" role="group" aria-label="${t('nav.language')}">
          <button type="button" data-lang="en" aria-pressed="${lang === 'en'}">EN</button>
          <button type="button" data-lang="uk" aria-pressed="${lang === 'uk'}">UK</button>
        </span>
        <a class="cart-link" href="/cart">${t('nav.cart')} <span class="badge" data-testid="cart-count">0</span></a>
        <a href="/login">${t('nav.signIn')}</a>
        ${who ? `<span class="who">${escapeHtml(who)}</span>` : ''}
      </nav>`;
    header.querySelectorAll('[data-lang]').forEach((btn) => {
      btn.addEventListener('click', () => setLanguage(btn.dataset.lang));
    });
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- pages ----------

  const pages = {};

  pages.catalogue = function () {
    const input = document.getElementById('search');
    const list = document.getElementById('book-list');
    const empty = document.getElementById('no-results');
    let searchRequest = 0;
    let timer = null;

    async function search(q) {
      const mine = ++searchRequest;
      try {
        const result = await api(`/api/books?q=${encodeURIComponent(q)}`, { auth: false });
        if (mine !== searchRequest) return;
        render(result.items);
      } catch (err) {
        if (mine !== searchRequest) return;
        list.innerHTML = `<p role="alert">${escapeHtml(err.message)}</p>`;
      }
    }

    function render(books) {
      empty.hidden = books.length > 0;
      list.innerHTML = books
        .map(
          (b) => `
        <article class="card">
          <h2>${escapeHtml(b.title)}</h2>
          <p class="author">${escapeHtml(t('catalogue.by', { author: b.author }))}</p>
          <p class="price">${money(b.priceCents)} EUR</p>
          <a href="/book/${b.id}">${t('catalogue.view')}<span class="visually-hidden">: ${escapeHtml(b.title)}</span></a>
        </article>`,
        )
        .join('');
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => search(input.value.slice(0, 100)), 300);
    });

    document.getElementById('clear-search').addEventListener('click', (event) => {
      event.preventDefault();
      input.value = '';
      clearTimeout(timer);
      search('');
      input.focus();
    });

    search('');
  };

  pages.book = async function () {
    const id = location.pathname.split('/').pop();
    const main = document.getElementById('book');
    const qty = document.getElementById('quantity');
    const button = document.getElementById('add-to-cart');
    const status = document.getElementById('status');
    const error = document.getElementById('quantity-error');

    let book;
    try {
      book = await api(`/api/books/${encodeURIComponent(id)}`, { auth: false });
    } catch (err) {
      main.innerHTML = `<h1>${t('book.notFound')}</h1><p><a href="/">${t('book.back')}</a></p>`;
      return;
    }
    document.title = `${book.title} - Bookshelf`;
    document.getElementById('book-title').textContent = book.title;
    document.getElementById('book-author').textContent = book.author;
    document.getElementById('book-year').textContent = book.year;
    document.getElementById('book-price').textContent = `${money(book.priceCents)} EUR`;
    button.disabled = false;

    button.addEventListener('click', async () => {
      status.textContent = '';
      error.textContent = '';
      const raw = qty.value.trim();
      const value = Number(raw);
      if (!/^\d+$/.test(raw) || value < 1 || value > 10) {
        error.textContent = t('book.quantityError');
        qty.setAttribute('aria-invalid', 'true');
        return;
      }
      qty.removeAttribute('aria-invalid');
      try {
        await withSession('/api/cart/items', { method: 'POST', body: { bookId: book.id, quantity: value } });
        status.textContent = t('book.added');
        refreshBadge();
      } catch (err) {
        error.textContent = err.code === 'VALIDATION_ERROR' ? t('book.quantityError') : t('common.error');
      }
    });
  };

  pages.cart = function () {
    const container = document.getElementById('cart');
    const promoForm = document.getElementById('promo-form');
    const promoInput = document.getElementById('promo');
    const promoMessage = document.getElementById('promo-message');

    function render(cart) {
      setBadge(cart.itemCount);
      if (!cart.lines.length) {
        container.innerHTML = `<p>${t('cart.empty')}</p>`;
        document.getElementById('cart-summary').hidden = true;
        return;
      }
      document.getElementById('cart-summary').hidden = false;
      container.innerHTML = `
        <table>
          <caption class="visually-hidden">${t('cart.title')}</caption>
          <thead><tr>
            <th scope="col">${t('cart.book')}</th>
            <th scope="col">${t('cart.quantity')}</th>
            <th scope="col">${t('cart.unitPrice')}</th>
            <th scope="col">${t('cart.lineTotal')}</th>
            <th scope="col"><span class="visually-hidden">${t('cart.remove')}</span></th>
          </tr></thead>
          <tbody>
          ${cart.lines
            .map(
              (line) => `
            <tr data-book-id="${line.bookId}">
              <td>${escapeHtml(line.title)}</td>
              <td><input class="qty" type="number" min="1" max="10" step="1" value="${line.quantity}"
                   aria-label="${t('cart.quantity')}: ${escapeHtml(line.title)}"></td>
              <td>${money(line.unitPriceCents)} EUR</td>
              <td>${money(line.lineTotalCents)} EUR</td>
              <td><button type="button" class="remove">${t('cart.remove')}<span class="visually-hidden">: ${escapeHtml(line.title)}</span></button></td>
            </tr>`,
            )
            .join('')}
          </tbody>
        </table>
        <p id="line-error" role="alert" class="error-text"></p>`;

      const totals = cart.totals;
      document.getElementById('subtotal').textContent = `${money(totals.subtotalCents)} EUR`;
      document.getElementById('discount').textContent = `-${money(totals.discountCents)} EUR`;
      document.getElementById('delivery').textContent =
        totals.deliveryCents === 0 ? t('cart.freeDelivery') : t('cart.delivery', { amount: money(totals.deliveryCents) });
      document.getElementById('total').textContent = `${money(totals.totalCents)} EUR`;
      const hint = document.getElementById('free-delivery-hint');
      hint.textContent = cart.freeDeliveryRemainingCents > 0
        ? t('cart.freeDeliveryHint', { amount: money(cart.freeDeliveryRemainingCents) })
        : '';
      document.getElementById('item-count-text').textContent = cart.itemCountText;
      const applied = document.getElementById('promo-applied');
      applied.hidden = !cart.promoCode;
      document.getElementById('promo-applied-text').textContent = cart.promoCode
        ? t('cart.promoApplied', { code: cart.promoCode })
        : '';

      container.querySelectorAll('tr[data-book-id]').forEach((row) => {
        const bookId = row.dataset.bookId;
        row.querySelector('.remove').addEventListener('click', async () => {
          render(await withSession(`/api/cart/items/${bookId}`, { method: 'DELETE' }));
        });
        row.querySelector('.qty').addEventListener('change', async (event) => {
          const raw = event.target.value.trim();
          const value = Number(raw);
          const lineError = document.getElementById('line-error');
          if (!/^\d+$/.test(raw) || value < 1 || value > 10) {
            lineError.textContent = t('book.quantityError');
            return;
          }
          try {
            render(await withSession(`/api/cart/items/${bookId}`, { method: 'PATCH', body: { quantity: value } }));
          } catch (err) {
            lineError.textContent = err.code === 'VALIDATION_ERROR' ? t('book.quantityError') : t('common.error');
          }
        });
      });
    }

    async function load() {
      if (!token()) {
        render({ lines: [], itemCount: 0 });
        return;
      }
      try {
        render(await withSession('/api/cart'));
      } catch (err) {
        container.innerHTML = `<p role="alert">${t('common.error')}</p>`;
      }
    }

    promoForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      promoMessage.textContent = '';
      const code = promoInput.value.trim();
      if (!code) return;
      try {
        render(await withSession('/api/cart/promo', { method: 'POST', body: { code } }));
        promoInput.value = '';
      } catch (err) {
        promoMessage.textContent = err.message;
      }
    });

    document.getElementById('remove-promo').addEventListener('click', async () => {
      render(await withSession('/api/cart/promo', { method: 'DELETE' }));
    });

    load();
  };

  pages.checkout = function () {
    const form = document.getElementById('checkout-form');
    const submit = document.getElementById('place-order');
    const formError = document.getElementById('form-error');
    let cart = null;

    const rules = {
      fullName: { min: 2, max: 80 },
      email: { email: true },
      street: { min: 2, max: 120 },
      city: { min: 2, max: 60 },
      postcode: { min: 3, max: 10 },
    };

    if (CONFIG.revision > 1) {
      form.querySelectorAll('input[name]').forEach((input) => {
        if (input.type === 'radio' || form.querySelector(`label[for="${input.id}"]`)) return;
        const label = document.createElement('label');
        label.htmlFor = input.id;
        label.textContent = input.placeholder;
        input.before(label);
      });
    }

    function problemOf(name, value) {
      const rule = rules[name];
      const text = value.trim();
      if (!text) return t('checkout.required');
      if (rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return t('checkout.emailFormat');
      if (rule.min && (text.length < rule.min || text.length > rule.max)) {
        return t('checkout.length', { min: rule.min, max: rule.max });
      }
      return null;
    }

    function hintFor(input) {
      let hint = document.getElementById(`${input.id}-error`);
      if (!hint) {
        hint = document.createElement('span');
        hint.id = `${input.id}-error`;
        hint.className = 'error-text';
        input.after(hint);
        input.setAttribute('aria-describedby', hint.id);
      }
      return hint;
    }

    if (CONFIG.revision > 1) {
      Object.keys(rules).forEach((name) => hintFor(form.elements[name]));
    }

    function showProblem(input, problem) {
      input.classList.toggle('invalid', Boolean(problem));
      if (CONFIG.revision < 2) return;
      const hint = hintFor(input);
      hint.textContent = problem || '';
      if (problem) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }

    function checkField(input) {
      const problem = problemOf(input.name, input.value);
      showProblem(input, problem);
      return !problem;
    }

    Object.keys(rules).forEach((name) => {
      const input = form.elements[name];
      input.addEventListener('blur', () => checkField(input));
    });

    function deliveryOption() {
      return form.elements.deliveryOption.value || 'standard';
    }

    function renderSummary() {
      const box = document.getElementById('summary');
      if (!cart || !cart.lines.length) {
        box.innerHTML = `<p>${t('checkout.emptyCart')}</p>`;
        return;
      }
      const delivery = deliveryOption() === 'pickup' ? 0 : cart.totals.deliveryCents;
      const total = cart.totals.subtotalCents - cart.totals.discountCents + delivery;
      box.innerHTML = `
        <ul>${cart.lines.map((l) => `<li>${escapeHtml(l.title)} x ${l.quantity}: ${money(l.lineTotalCents)} EUR</li>`).join('')}</ul>
        <p>${t('cart.subtotal')}: ${money(cart.totals.subtotalCents)} EUR</p>
        <p>${t('cart.discount')}: -${money(cart.totals.discountCents)} EUR</p>
        <p>${delivery === 0 ? t('cart.freeDelivery') : t('cart.delivery', { amount: money(delivery) })}</p>
        <p><strong>${t('cart.total')}: ${money(total)} EUR</strong></p>`;
    }

    form.querySelectorAll('input[name="deliveryOption"]').forEach((radio) => {
      radio.addEventListener('change', renderSummary);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      formError.textContent = '';
      const inputs = Object.keys(rules).map((name) => form.elements[name]);
      const allValid = inputs.map(checkField).every(Boolean);
      if (!allValid) {
        if (CONFIG.revision > 1) formError.textContent = t('checkout.fixErrors');
        return;
      }
      const body = {
        address: Object.fromEntries(inputs.map((input) => [input.name, input.value.trim()])),
        deliveryOption: deliveryOption(),
      };
      if (CONFIG.revision > 1) submit.disabled = true;
      try {
        const order = await withSession('/api/orders', { method: 'POST', body });
        console.info(`order placed ${order.id}`);
        location.href = `/order/${order.id}`;
      } catch (err) {
        console.error(`order failed: ${err.status} ${err.code || ''}`.trim());
        formError.textContent = err.message || t('common.error');
        submit.disabled = false;
      }
    });

    (async () => {
      try {
        cart = token() ? await withSession('/api/cart') : null;
      } catch (err) {
        cart = null;
      }
      renderSummary();
    })();
  };

  pages.order = async function () {
    const id = decodeURIComponent(location.pathname.split('/').pop());
    const main = document.getElementById('order');
    try {
      const order = await withSession(`/api/orders/${encodeURIComponent(id)}`);
      main.innerHTML = `
        <h1>${t('order.title', { id: escapeHtml(order.id) })}</h1>
        <p>${t('order.status')}: <strong data-testid="order-status">${order.status === 'received' ? t('order.received') : escapeHtml(order.status)}</strong></p>
        <table>
          <thead><tr><th scope="col">${t('cart.book')}</th><th scope="col">${t('cart.quantity')}</th><th scope="col">${t('cart.lineTotal')}</th></tr></thead>
          <tbody>${order.lines
            .map((l) => `<tr><td>${escapeHtml(l.title)}</td><td>${l.quantity}</td><td>${money(l.lineTotalCents)} EUR</td></tr>`)
            .join('')}</tbody>
        </table>
        <dl class="totals">
          <dt>${t('cart.subtotal')}</dt><dd>${money(order.totals.subtotalCents)} EUR</dd>
          <dt>${t('cart.discount')}</dt><dd>-${money(order.totals.discountCents)} EUR</dd>
          <dt>${t('order.deliverTo')}</dt><dd>${order.address ? escapeHtml(`${order.address.fullName}, ${order.address.street}, ${order.address.postcode} ${order.address.city}`) : ''}</dd>
          <dt>${order.totals.deliveryCents === 0 ? t('cart.freeDelivery') : t('cart.delivery', { amount: money(order.totals.deliveryCents) })}</dt><dd></dd>
          <dt>${t('cart.total')}</dt><dd><strong>${money(order.totals.totalCents)} EUR</strong></dd>
        </dl>
        <p><a href="/">${t('order.continue')}</a></p>`;
    } catch (err) {
      main.innerHTML = `<h1>${t('order.notFound')}</h1><p><a href="/">${t('order.continue')}</a></p>`;
    }
  };

  pages.login = function () {
    const form = document.getElementById('login-form');
    const message = document.getElementById('login-message');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.textContent = '';
      const email = form.elements.email.value.trim();
      try {
        const session = await api('/api/auth/login', {
          method: 'POST',
          auth: false,
          body: { email, password: form.elements.password.value },
        });
        saveSession(session, email.toLowerCase());
        location.href = '/';
      } catch (err) {
        message.textContent = err.status === 401 ? t('login.failed') : err.message;
      }
    });

    document.getElementById('guest').addEventListener('click', async () => {
      clearSession();
      try {
        await startGuest();
        renderHeader();
        refreshBadge();
        document.getElementById('guest-ready').hidden = false;
      } catch (err) {
        message.textContent = t('common.error');
      }
    });
  };

  // ---------- start ----------

  async function boot() {
    await loadMessages();
    renderHeader();
    translatePage();
    console.info(`Bookshelf UI loaded, lang=${lang}`);
    const page = document.body.dataset.page;
    if (page !== 'cart') refreshBadge();
    if (pages[page]) await pages[page]();
  }

  boot();
})();
