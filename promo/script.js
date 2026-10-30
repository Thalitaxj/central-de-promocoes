/* =========================================================
   Central de Promoções — Assistente de Compras Inteligente
   ========================================================= */

/* ---------------------------------------------------------
   CONFIGURAÇÃO DE LOJAS E AFILIADOS
   Os valores abaixo são apenas o PADRÃO inicial. A área do
   dono (painel ⚙️) sobrescreve tudo isso via localStorage:
   tags de afiliado, ativar/desativar loja, URL template e
   lojas extras (AliExpress, Magalu, etc.).
   Ver owner.js para a lógica completa.
   --------------------------------------------------------- */

// Parâmetro de afiliado usado por cada loja conhecida na query string.
const AFFILIATE_PARAM = {
  amazon:       "tag",
  shopee:       "af_id",
  mercadolivre: "matt_word",
  aliexpress:   "aff_id",
  magalu:       "partner",
  casasbahia:   "parceiro"
};

// Taxa de comissão de referência por loja (para a estimativa de ganhos).
const COMMISSION_RATE = {
  amazon:       0.08,
  shopee:       0.10,
  mercadolivre: 0.06,
  central:      0.00,
  _default:     0.05
};

// Config padrão das lojas (sobrescrita pelo painel do dono).
const DEFAULT_STORES = {
  central:      { label: "Central de Promoções", color: "#FF6A00", emoji: "🏬", search: "",                                  affiliate: "", enabled: true, locked: true },
  amazon:       { label: "Amazon",        color: "#FF9900", emoji: "📦", search: "https://www.amazon.com.br/s?k=",          affiliate: "", enabled: true },
  shopee:       { label: "Shopee",        color: "#EE4D2D", emoji: "🛍️", search: "https://shopee.com.br/search?keyword=",  affiliate: "", enabled: true },
  mercadolivre: { label: "Mercado Livre", color: "#FFE600", emoji: "💛", search: "https://lista.mercadolivre.com.br/",      affiliate: "", enabled: true }
};

// Ponte de analytics: owner.js registra window.__track. Aqui garantimos que
// chamar track() nunca quebre, mesmo se o módulo do dono não estiver presente.
function track(type, payload) {
  if (typeof window.__track === "function") window.__track(type, payload);
}

// Carrega a config das lojas (padrão + ajustes salvos pelo dono).
// Migração: converte dados antigos que usavam a chave "suaempresa"
// para a nova chave "central". Roda uma única vez e é idempotente.
function migrateStoreKey() {
  if (localStorage.getItem("se_migrated_central")) return;
  try {
    // config de lojas
    const stores = JSON.parse(localStorage.getItem("se_stores") || "null");
    if (stores && stores.suaempresa && !stores.central) {
      stores.central = stores.suaempresa; delete stores.suaempresa;
      localStorage.setItem("se_stores", JSON.stringify(stores));
    }
    // eventos de analytics
    const events = JSON.parse(localStorage.getItem("se_events") || "null");
    if (Array.isArray(events)) {
      let changed = false;
      events.forEach(e => { if (e.store === "suaempresa") { e.store = "central"; changed = true; } });
      if (changed) localStorage.setItem("se_events", JSON.stringify(events));
    }
    // carrinho
    const cart = JSON.parse(localStorage.getItem("se_cart_v2") || "null");
    if (Array.isArray(cart)) {
      let changed = false;
      cart.forEach(it => { if (it.store === "suaempresa") { it.store = "central"; changed = true; } });
      if (changed) localStorage.setItem("se_cart_v2", JSON.stringify(cart));
    }
  } catch { /* ignora erros de dados corrompidos */ }
  localStorage.setItem("se_migrated_central", "1");
}
migrateStoreKey();

function loadStoreConfig() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem("se_stores")) || {}; } catch { saved = {}; }
  const merged = {};
  // começa pelos padrões
  Object.keys(DEFAULT_STORES).forEach(k => { merged[k] = { ...DEFAULT_STORES[k], ...(saved[k] || {}) }; });
  // adiciona lojas extras criadas pelo dono
  Object.keys(saved).forEach(k => { if (!merged[k]) merged[k] = saved[k]; });
  return merged;
}

// STORE_CONFIG é a fonte de verdade em runtime. STORE_META é derivado dela
// para manter compatibilidade com o resto do código.
let STORE_CONFIG = loadStoreConfig();
let STORE_META = buildStoreMeta();

function buildStoreMeta() {
  const meta = {};
  Object.entries(STORE_CONFIG).forEach(([k, v]) => {
    meta[k] = { label: v.label, color: v.color, emoji: v.emoji || "🏷️", search: v.search || "" };
  });
  return meta;
}

// Chamado pelo painel do dono quando salva configurações.
function refreshStoreConfig() {
  STORE_CONFIG = loadStoreConfig();
  STORE_META = buildStoreMeta();
  renderShowcase();
  renderCart();
}

// ---------- Catálogo ----------
// Cada oferta de loja tem preço, avaliação (rating) e nº de avaliações.
// Isso permite calcular menor preço, melhor custo-benefício e melhor qualidade.
const PRODUCTS = [
  {
    id: 1, name: "Tênis Corrida Nitro", cat: "calcados", catLabel: "Calçados",
    img: "assets/tenis.svg", promo: true, keywords: ["tenis", "corrida", "nitro", "calcado", "sapato"],
    desc: "Tênis de corrida leve com amortecimento Nitro, cabedal respirável e solado antiderrapante.",
    stores: [
      { store: "central",      price: 199.0, rating: 4.5, reviews: 320 },
      { store: "amazon",       price: 219.9, rating: 4.7, reviews: 1850 },
      { store: "shopee",       price: 189.9, rating: 4.2, reviews: 540 },
      { store: "mercadolivre", price: 205.0, rating: 4.6, reviews: 980 }
    ]
  },
  {
    id: 2, name: "Headphone Bluetooth X", cat: "audio", catLabel: "Áudio",
    img: "assets/headphone.svg", promo: true, keywords: ["headphone", "fone", "bluetooth", "audio", "ouvido"],
    desc: "Fone over-ear sem fio com cancelamento de ruído, graves potentes e até 30h de bateria.",
    stores: [
      { store: "central",      price: 89.9, rating: 4.0, reviews: 210 },
      { store: "amazon",       price: 99.9, rating: 4.6, reviews: 3200 },
      { store: "shopee",       price: 84.5, rating: 3.9, reviews: 720 },
      { store: "mercadolivre", price: 92.0, rating: 4.4, reviews: 1400 }
    ]
  },
  {
    id: 3, name: "Mochila Tech", cat: "acessorios", catLabel: "Acessórios",
    img: "assets/mochila.svg", promo: false, keywords: ["mochila", "bag", "notebook", "acessorio", "bolsa"],
    desc: "Mochila resistente à água com compartimento para notebook de até 15\", porta USB e design urbano.",
    stores: [
      { store: "central",      price: 149.0, rating: 4.7, reviews: 180 },
      { store: "amazon",       price: 159.9, rating: 4.5, reviews: 910 },
      { store: "shopee",       price: 154.9, rating: 4.3, reviews: 430 },
      { store: "mercadolivre", price: 144.9, rating: 4.6, reviews: 650 }
    ]
  },
  {
    id: 4, name: "Relógio Inteligente", cat: "eletronicos", catLabel: "Eletrônicos",
    img: "assets/relogio.svg", promo: true, keywords: ["relogio", "smartwatch", "watch", "eletronico", "inteligente"],
    desc: "Smartwatch com monitor de batimentos, oxigenação, GPS e mais de 100 modos esportivos.",
    stores: [
      { store: "central",      price: 259.9, rating: 4.8, reviews: 260 },
      { store: "amazon",       price: 249.9, rating: 4.7, reviews: 2100 },
      { store: "shopee",       price: 269.0, rating: 4.1, reviews: 600 },
      { store: "mercadolivre", price: 255.5, rating: 4.6, reviews: 1150 }
    ]
  },
  {
    id: 5, name: "Câmera Esportiva", cat: "eletronicos", catLabel: "Eletrônicos",
    img: "assets/camera.svg", promo: false, keywords: ["camera", "action", "esportiva", "4k", "filmadora", "gopro"],
    desc: "Câmera de ação 4K à prova d'água, estabilização avançada e grande angular.",
    stores: [
      { store: "central",      price: 319.0, rating: 4.3, reviews: 140 },
      { store: "amazon",       price: 329.9, rating: 4.6, reviews: 1600 },
      { store: "shopee",       price: 309.9, rating: 4.0, reviews: 380 },
      { store: "mercadolivre", price: 324.0, rating: 4.4, reviews: 720 }
    ]
  }
];

/* =========================================================
   Utilitários de preço, avaliação e links
   ========================================================= */
function brl(n) {
  return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function getProduct(id) { return PRODUCTS.find(p => p.id === id); }

function storeMeta(key) {
  return STORE_META[key] || { label: key, color: "#888", emoji: "🏷️", search: "" };
}

// Preço médio do produto (usado como "preço de vitrine")
function basePrice(p) {
  return p.stores.reduce((a, s) => a + s.price, 0) / p.stores.length;
}
// Preço exibido no cartão = menor preço disponível
function displayPrice(p) {
  return Math.min(...p.stores.map(s => s.price));
}
// Avaliação exibida = média ponderada simples das lojas
function displayRating(p) {
  return p.stores.reduce((a, s) => a + s.rating, 0) / p.stores.length;
}

// Monta o link para a loja, aplicando tag de afiliado quando configurada.
function affiliateLink(storeKey, productName) {
  const cfg = STORE_CONFIG[storeKey];
  if (!cfg || !cfg.search) return null;
  const q = encodeURIComponent(productName);
  let url = cfg.search + q;
  const tag = cfg.affiliate;
  if (tag) {
    const param = AFFILIATE_PARAM[storeKey] || "aff";
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}${param}=${encodeURIComponent(tag)}`;
  }
  return url;
}

// Lista de chaves de lojas ativas (exclui as desativadas pelo dono).
function activeStoreKeys() {
  return Object.keys(STORE_CONFIG).filter(k => STORE_CONFIG[k].enabled !== false);
}

// Taxa de comissão de uma loja (com fallback).
function commissionRate(storeKey) {
  if (storeKey in COMMISSION_RATE) return COMMISSION_RATE[storeKey];
  const cfg = STORE_CONFIG[storeKey];
  if (cfg && typeof cfg.commission === "number") return cfg.commission;
  return COMMISSION_RATE._default;
}

/* ---------------------------------------------------------
   As 3 recomendações por produto:
   - menor preço
   - melhor custo-benefício (preço ponderado pela avaliação)
   - melhor qualidade (maior rating, desempate por nº de reviews)
   --------------------------------------------------------- */
function recommendations(p) {
  const offers = p.stores.map(s => ({ ...s, meta: storeMeta(s.store) }));

  const cheapest = offers.reduce((a, b) => (b.price < a.price ? b : a));

  // custo-benefício: menor valor de (preço / rating²) — premia preço baixo e boa nota
  const value = offers.reduce((a, b) => {
    const sa = a.price / (a.rating * a.rating);
    const sb = b.price / (b.rating * b.rating);
    return sb < sa ? b : a;
  });

  const best = offers.reduce((a, b) => {
    if (b.rating !== a.rating) return b.rating > a.rating ? b : a;
    return b.reviews > a.reviews ? b : a;
  });

  return { cheapest, value, best };
}

// Ordena ofertas do menor para o maior preço, marcando a mais barata.
function storePrices(p) {
  const list = p.stores.slice().sort((a, b) => a.price - b.price);
  const min = list[0] ? list[0].price : null;
  return list.map(s => ({ ...s, meta: storeMeta(s.store), cheapest: s.price === min }));
}

/* =========================================================
   Estado
   ========================================================= */
const state = {
  view: "loja",
  cat: "todas",
  search: "",
  // carrinho multi-loja: array de { id, store, price, qty }
  cart: loadJSON("se_cart_v2", []),
  favs: new Set(loadJSON("se_favs", []))
};

function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; }
  catch { return fallback; }
}
function saveState() {
  localStorage.setItem("se_cart_v2", JSON.stringify(state.cart));
  localStorage.setItem("se_favs", JSON.stringify([...state.favs]));
}

/* =========================================================
   Atalhos de DOM
   ========================================================= */
const $ = sel => document.querySelector(sel);
const showcase = $("#showcase");
const emptyState = $("#emptyState");
const cartBadge = $("#cartBadge");
const viewTitle = $("#viewTitle");
const viewSub = $("#viewSub");
const toolbar = $("#toolbar");

/* =========================================================
   Estrelas
   ========================================================= */
function starsHTML(rating) {
  let html = "";
  for (let i = 1; i <= 5; i++) {
    const cls = i <= Math.round(rating) ? "" : "off";
    html += `<svg class="${cls}" viewBox="0 0 24 24" width="15" height="15"><use href="#icon-star"/></svg>`;
  }
  return `<div class="stars">${html}<small>${rating.toFixed(1)}</small></div>`;
}

/* =========================================================
   Comparação e recomendações (HTML)
   ========================================================= */
function recoCardsHTML(p) {
  const r = recommendations(p);
  const items = [
    { key: "cheapest", icon: "💰", title: "Menor Preço",         o: r.cheapest, cls: "reco--price" },
    { key: "value",    icon: "⚖️", title: "Melhor Custo-Benefício", o: r.value,    cls: "reco--value" },
    { key: "best",     icon: "⭐", title: "Melhor Qualidade",     o: r.best,     cls: "reco--best" }
  ];
  return `
    <div class="reco">
      ${items.map(it => `
        <div class="reco__card ${it.cls}">
          <div class="reco__head"><span class="reco__icon">${it.icon}</span>${it.title}</div>
          <div class="reco__store"><span class="compare__dot" style="background:${it.o.meta.color}"></span>${it.o.meta.label}</div>
          <div class="reco__price">${brl(it.o.price)}</div>
          <div class="reco__rating">${starsHTML(it.o.rating)}</div>
          <button class="btn btn--cart reco__add" data-add="${p.id}" data-store="${it.o.store}">Adicionar</button>
        </div>`).join("")}
    </div>`;
}

function compareTableHTML(p) {
  const prices = storePrices(p);
  const rows = prices.map(s => {
    const link = affiliateLink(s.store, p.name);
    const action = link
      ? `<a class="compare__go" href="${link}" target="_blank" rel="noopener noreferrer sponsored" data-click="${p.id}" data-store="${s.store}" data-price="${s.price}">Ver oferta ↗</a>`
      : `<span class="compare__here">Esta loja</span>`;
    return `
      <div class="compare__row ${s.cheapest ? "is-best" : ""}">
        <span class="compare__store">
          <span class="compare__dot" style="background:${s.meta.color}"></span>${s.meta.label}
          ${s.cheapest ? `<span class="compare__badge">Menor preço</span>` : ""}
        </span>
        <span class="compare__price">${brl(s.price)} <small>★ ${s.rating.toFixed(1)}</small></span>
        <span class="compare__actions">
          <button class="compare__cart" data-add="${p.id}" data-store="${s.store}" aria-label="Adicionar ${s.meta.label} ao carrinho">+ carrinho</button>
          ${action}
        </span>
      </div>`;
  }).join("");
  return `
    <div class="compare">
      <h4 class="compare__title">Comparação entre lojas</h4>
      <div class="compare__list">${rows}</div>
      <p class="compare__note">Valores de referência do catálogo. Os botões "Ver oferta" abrem a loja (links de afiliado quando configurados).</p>
    </div>`;
}

// Resumo compacto no cartão
function priceSummaryHTML(p) {
  const r = recommendations(p);
  return `
    <button class="price-compare" data-detail="${p.id}" aria-label="Comparar ${p.name}">
      <span class="price-compare__best" style="--c:${r.cheapest.meta.color}">
        A partir de <strong>${brl(r.cheapest.price)}</strong> · ${r.cheapest.meta.label}
      </span>
      <span class="price-compare__link">Ver 3 recomendações e comparar →</span>
    </button>`;
}

// Tag que mostra a loja do menor preço direto no cartão da vitrine.
function cheapestStoreTagHTML(p) {
  const c = recommendations(p).cheapest;
  return `
    <div class="card__store" title="Menor preço na loja ${c.meta.label}">
      <span class="card__store-dot" style="background:${c.meta.color}"></span>
      <span class="card__store-emoji">${c.meta.emoji || "🏷️"}</span>
      <span class="card__store-name">${c.meta.label}</span>
    </div>`;
}

/* =========================================================
   Vitrine
   ========================================================= */
function currentProducts() {
  let list = PRODUCTS.slice();
  if (state.view === "promocoes") list = list.filter(p => p.promo);
  if (state.cat !== "todas") list = list.filter(p => p.cat === state.cat);
  if (state.search.trim()) {
    const q = norm(state.search);
    list = list.filter(p => matchProduct(p, q));
  }
  return list;
}

function renderShowcase() {
  const list = currentProducts();
  showcase.innerHTML = "";
  if (!list.length) { emptyState.hidden = false; return; }
  emptyState.hidden = true;

  list.forEach((p, i) => {
    const isFav = state.favs.has(p.id);
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${i * 0.05}s`;
    card.innerHTML = `
      <button class="card__fav ${isFav ? "is-fav" : ""}" data-fav="${p.id}" aria-label="Favoritar ${p.name}" aria-pressed="${isFav}">
        <svg viewBox="0 0 24 24" width="18" height="18"><use href="#icon-heart"/></svg>
      </button>
      <div class="card__media" data-detail="${p.id}"><img src="${p.img}" alt="${p.name}" loading="lazy" /></div>
      <span class="card__cat">${p.catLabel}</span>
      <h3 class="card__name" data-detail="${p.id}">${p.name}</h3>
      ${starsHTML(displayRating(p))}
      <div class="card__price">${brl(displayPrice(p))} <small>a partir de</small></div>
      ${cheapestStoreTagHTML(p)}
      ${priceSummaryHTML(p)}
      <div class="card__actions">
        <button class="btn btn--cart" data-add="${p.id}">Adicionar</button>
        <button class="btn btn--buy" data-buy="${p.id}">Comprar</button>
      </div>`;
    showcase.appendChild(card);
  });
}

/* =========================================================
   Navegação entre views
   ========================================================= */
const VIEW_META = {
  loja:       { title: "Vitrine de Produtos", sub: "As melhores ofertas selecionadas para você" },
  categorias: { title: "Categorias",          sub: "Explore nossos produtos por categoria" },
  promocoes:  { title: "Promoções",           sub: "Ofertas especiais com os melhores preços" }
};

function setView(view) {
  if (view === "carrinho") { openCart(); return; }
  if (view === "assistente") { openAssistant(); return; }
  state.view = view;
  document.querySelectorAll(".nav__link").forEach(b => b.classList.toggle("is-active", b.dataset.view === view));
  const meta = VIEW_META[view] || VIEW_META.loja;
  viewTitle.textContent = meta.title;
  viewSub.textContent = meta.sub;
  toolbar.style.display = "flex";
  renderShowcase();
  closeMenu();
}

/* =========================================================
   Carrinho multi-loja
   ========================================================= */
function findCartItem(id, store) {
  return state.cart.find(it => it.id === id && it.store === store);
}
function cartCount() { return state.cart.reduce((a, it) => a + it.qty, 0); }
function cartTotal() { return state.cart.reduce((a, it) => a + it.price * it.qty, 0); }

function updateBadge() {
  cartBadge.textContent = cartCount();
  cartBadge.style.transform = "scale(1.4)";
  setTimeout(() => (cartBadge.style.transform = "scale(1)"), 180);
}

// store opcional: se não vier, usa a loja de menor preço
function addToCart(id, store, silent) {
  const p = getProduct(id);
  if (!p) return;
  if (!store) store = recommendations(p).cheapest.store;
  const offer = p.stores.find(s => s.store === store);
  if (!offer) return;
  const existing = findCartItem(id, store);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, store, price: offer.price, qty: 1 });
  saveState(); updateBadge(); renderCart();
  track("cart", { id, name: p.name, store, price: offer.price });
  if (!silent) toast(`${p.name} (${storeMeta(store).label}) adicionado`);
}

function setQty(id, store, qty) {
  const it = findCartItem(id, store);
  if (!it) return;
  if (qty <= 0) state.cart = state.cart.filter(x => !(x.id === id && x.store === store));
  else it.qty = qty;
  saveState(); updateBadge(); renderCart();
}
function removeFromCart(id, store) {
  state.cart = state.cart.filter(x => !(x.id === id && x.store === store));
  saveState(); updateBadge(); renderCart();
  toast("Item removido do carrinho");
}

function renderCart() {
  const items = $("#cartItems");
  if (!state.cart.length) {
    items.innerHTML = `<div class="cart-empty">Seu carrinho está vazio.<br>Adicione produtos de qualquer loja para continuar.</div>`;
    $("#cartTotal").textContent = brl(0);
    return;
  }

  // Agrupa por loja para deixar claro de quem é cada preço
  const byStore = {};
  state.cart.forEach(it => { (byStore[it.store] = byStore[it.store] || []).push(it); });

  items.innerHTML = Object.entries(byStore).map(([store, list]) => {
    const meta = storeMeta(store);
    const subtotal = list.reduce((a, it) => a + it.price * it.qty, 0);
    const rows = list.map(it => {
      const p = getProduct(it.id);
      return `
        <div class="cart-row">
          <img src="${p.img}" alt="${p.name}" />
          <div class="cart-row__info">
            <div class="cart-row__name">${p.name}</div>
            <div class="cart-row__price">${brl(it.price)}</div>
            <div class="qty">
              <button data-dec="${it.id}" data-store="${store}" aria-label="Diminuir">−</button>
              <span>${it.qty}</span>
              <button data-inc="${it.id}" data-store="${store}" aria-label="Aumentar">+</button>
            </div>
          </div>
          <button class="cart-row__remove" data-remove="${it.id}" data-store="${store}" aria-label="Remover">
            <svg viewBox="0 0 24 24" width="20" height="20"><use href="#icon-trash"/></svg>
          </button>
        </div>`;
    }).join("");
    const link = affiliateLink(store, "carrinho") ;
    const go = link
      ? `<a class="seller__go" href="${link}" target="_blank" rel="noopener noreferrer sponsored">Finalizar na ${meta.label} ↗</a>`
      : "";
    return `
      <div class="seller-group">
        <div class="seller-head">
          <span class="seller-name"><span class="compare__dot" style="background:${meta.color}"></span>${meta.label}</span>
          <span class="seller-sub">${brl(subtotal)}</span>
        </div>
        ${rows}
        ${go}
      </div>`;
  }).join("");
  $("#cartTotal").textContent = brl(cartTotal());
}

function openCart() {
  renderCart();
  $("#cartDrawer").classList.add("open");
  $("#cartDrawer").setAttribute("aria-hidden", "false");
  $("#drawerOverlay").classList.add("open");
}
function closeCart() {
  $("#cartDrawer").classList.remove("open");
  $("#cartDrawer").setAttribute("aria-hidden", "true");
  $("#drawerOverlay").classList.remove("open");
}

/* =========================================================
   Favoritos
   ========================================================= */
function toggleFav(id) {
  if (state.favs.has(id)) { state.favs.delete(id); toast("Removido dos favoritos"); }
  else { state.favs.add(id); toast("Adicionado aos favoritos ♥"); }
  saveState();
  const btn = document.querySelector(`[data-fav="${id}"]`);
  if (btn) { const on = state.favs.has(id); btn.classList.toggle("is-fav", on); btn.setAttribute("aria-pressed", on); }
}

/* =========================================================
   Modal de detalhes (com 3 recomendações + comparação)
   ========================================================= */
function openDetail(id) {
  const p = getProduct(id);
  if (!p) return;
  $("#modalImg").src = p.img;
  $("#modalImg").alt = p.name;
  $("#modalCat").textContent = p.catLabel;
  $("#modalName").textContent = p.name;
  $("#modalStars").innerHTML = starsHTML(displayRating(p));
  $("#modalDesc").textContent = p.desc;
  $("#modalPrice").innerHTML = `${brl(displayPrice(p))} <small>a partir de</small>`;
  $("#modalCompare").innerHTML = recoCardsHTML(p) + compareTableHTML(p);
  $("#modalAddCart").dataset.add = id;
  $("#modalBuy").dataset.buy = id;
  $("#modalOverlay").classList.add("open");
}
function closeDetail() { $("#modalOverlay").classList.remove("open"); }

/* =========================================================
   Assistente de lista de compras
   ========================================================= */
function norm(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function matchProduct(p, qNorm) {
  const hay = norm(p.name + " " + p.catLabel + " " + (p.keywords || []).join(" "));
  return qNorm.split(/\s+/).some(tok => tok.length > 1 && hay.includes(tok));
}

// Interpreta a lista (linhas ou vírgulas) e casa cada termo com um produto.
function parseShoppingList(text) {
  const terms = text.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
  const results = [];
  const seen = new Set();
  terms.forEach(term => {
    const q = norm(term);
    // melhor correspondência: produto cujo nome/keywords contém mais tokens do termo
    let best = null, bestScore = 0;
    PRODUCTS.forEach(p => {
      const hay = norm(p.name + " " + (p.keywords || []).join(" "));
      const score = q.split(/\s+/).reduce((acc, tok) => acc + (tok.length > 1 && hay.includes(tok) ? 1 : 0), 0);
      if (score > bestScore) { bestScore = score; best = p; }
    });
    results.push({ term, product: bestScore > 0 ? best : null });
    if (best && bestScore > 0) seen.add(best.id);
  });
  return results;
}

function renderAssistantResults(results) {
  const box = $("#assistantResults");
  const found = results.filter(r => r.product);
  const missing = results.filter(r => !r.product);

  if (!results.length) { box.innerHTML = ""; return; }

  let html = "";

  if (found.length) {
    // total somando o menor preço de cada item encontrado
    const totalMin = found.reduce((a, r) => a + recommendations(r.product).cheapest.price, 0);
    html += `<div class="assist__summary">
      <span>${found.length} produto(s) encontrado(s)</span>
      <strong>Menor total: ${brl(totalMin)}</strong>
    </div>`;

    html += found.map(r => {
      const p = r.product;
      const rec = recommendations(p);
      return `
        <div class="assist__item">
          <img src="${p.img}" alt="${p.name}" />
          <div class="assist__info">
            <div class="assist__term">“${r.term}” →</div>
            <div class="assist__name">${p.name}</div>
            <div class="assist__opts">
              <span class="assist__opt" style="--c:${rec.cheapest.meta.color}">💰 ${brl(rec.cheapest.price)} · ${rec.cheapest.meta.label}</span>
              <span class="assist__opt" style="--c:${rec.value.meta.color}">⚖️ ${brl(rec.value.price)} · ${rec.value.meta.label}</span>
              <span class="assist__opt" style="--c:${rec.best.meta.color}">⭐ ${rec.best.rating.toFixed(1)} · ${rec.best.meta.label}</span>
            </div>
          </div>
          <div class="assist__actions">
            <button class="btn btn--cart" data-add="${p.id}" data-store="${rec.cheapest.store}">+ menor preço</button>
            <button class="assist__detail" data-detail="${p.id}">detalhes</button>
          </div>
        </div>`;
    }).join("");

    html += `<button class="btn btn--buy btn--block" id="assistAddAll">Adicionar todos pelo menor preço</button>`;
  }

  if (missing.length) {
    html += `<div class="assist__missing">Não encontramos no catálogo: ${missing.map(m => `<em>${m.term}</em>`).join(", ")}</div>`;
  }

  box.innerHTML = html;
  box.dataset.found = JSON.stringify(found.map(r => r.product.id));
}

function openAssistant() {
  $("#assistantOverlay").classList.add("open");
  $("#assistantInput").focus();
}
function closeAssistant() { $("#assistantOverlay").classList.remove("open"); }

/* =========================================================
   Checkout (simulado)
   ========================================================= */
function checkout() {
  if (!cartCount()) { toast("Seu carrinho está vazio"); return; }
  const total = brl(cartTotal());
  // registra cada item como compra efetuada (por loja)
  state.cart.forEach(it => {
    const p = getProduct(it.id);
    track("purchase", { id: it.id, name: p ? p.name : "", store: it.store, price: it.price * it.qty, qty: it.qty });
  });
  state.cart = [];
  saveState(); updateBadge(); renderCart(); closeCart();
  toast(`Compra finalizada! Total: ${total} 🎉`);
}

/* =========================================================
   Toast / menu
   ========================================================= */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function closeMenu() {
  $(".nav").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded", "false");
}

/* =========================================================
   Eventos
   ========================================================= */
function handleAddClick(el) {
  const id = Number(el.dataset.add);
  const store = el.dataset.store || null;
  addToCart(id, store);
}

function bindEvents() {
  document.querySelectorAll(".nav__link").forEach(btn =>
    btn.addEventListener("click", () => setView(btn.dataset.view)));

  $("#menuToggle").addEventListener("click", () => {
    const nav = $(".nav");
    const open = nav.classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", open);
  });

  // Vitrine
  showcase.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    const buy = e.target.closest("[data-buy]");
    const fav = e.target.closest("[data-fav]");
    const detail = e.target.closest("[data-detail]");
    if (add) return handleAddClick(add);
    if (buy) {
      const p = getProduct(Number(buy.dataset.buy));
      const rec = recommendations(p).cheapest;
      track("click", { id: p.id, name: p.name, store: rec.store, price: rec.price });
      addToCart(Number(buy.dataset.buy), null, true); openCart(); return;
    }
    if (fav) return toggleFav(Number(fav.dataset.fav));
    if (detail) return openDetail(Number(detail.dataset.detail));
  });

  $("#searchInput").addEventListener("input", e => { state.search = e.target.value; renderShowcase(); });

  $("#filters").addEventListener("click", e => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    state.cat = chip.dataset.cat;
    document.querySelectorAll(".chip").forEach(c => c.classList.toggle("is-active", c === chip));
    renderShowcase();
  });

  // Carrinho
  $("#cartItems").addEventListener("click", e => {
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    const rem = e.target.closest("[data-remove]");
    if (inc) { const it = findCartItem(Number(inc.dataset.inc), inc.dataset.store); setQty(it.id, it.store, it.qty + 1); }
    if (dec) { const it = findCartItem(Number(dec.dataset.dec), dec.dataset.store); setQty(it.id, it.store, it.qty - 1); }
    if (rem) removeFromCart(Number(rem.dataset.remove), rem.dataset.store);
  });
  $("#cartClose").addEventListener("click", closeCart);
  $("#drawerOverlay").addEventListener("click", closeCart);
  $("#checkoutBtn").addEventListener("click", checkout);

  // Modal (recomendações + comparação usam data-add/data-store e data-detail)
  $("#modalCompare").addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    const go = e.target.closest("[data-click]");
    if (go) {
      const p = getProduct(Number(go.dataset.click));
      track("click", { id: p.id, name: p.name, store: go.dataset.store, price: Number(go.dataset.price) });
      // não damos return: deixa o link abrir normalmente
    }
    if (add) return handleAddClick(add);
  });
  $("#modalClose").addEventListener("click", closeDetail);
  $("#modalOverlay").addEventListener("click", e => { if (e.target === $("#modalOverlay")) closeDetail(); });
  $("#modalAddCart").addEventListener("click", e => addToCart(Number(e.target.dataset.add)));
  $("#modalBuy").addEventListener("click", e => { addToCart(Number(e.target.dataset.buy), null, true); closeDetail(); openCart(); });

  // Assistente
  $("#assistantClose").addEventListener("click", closeAssistant);
  $("#assistantOverlay").addEventListener("click", e => { if (e.target === $("#assistantOverlay")) closeAssistant(); });
  $("#assistantRun").addEventListener("click", () => {
    const results = parseShoppingList($("#assistantInput").value);
    renderAssistantResults(results);
  });
  $("#assistantResults").addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    const detail = e.target.closest("[data-detail]");
    const all = e.target.closest("#assistAddAll");
    if (add) return handleAddClick(add);
    if (detail) { closeAssistant(); return openDetail(Number(detail.dataset.detail)); }
    if (all) {
      const ids = JSON.parse($("#assistantResults").dataset.found || "[]");
      ids.forEach(id => addToCart(id, null, true));
      toast(`${ids.length} item(ns) adicionados pelo menor preço`);
      closeAssistant(); openCart();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeCart(); closeDetail(); closeAssistant(); }
  });
}

/* =========================================================
   Init
   ========================================================= */
function init() {
  bindEvents();
  updateBadge();
  renderCart();
  setView("loja");
}
document.addEventListener("DOMContentLoaded", init);

/* ---------------------------------------------------------
   Exposição para o módulo da área do dono (owner.js).
   owner.js lê estes valores via window.* para configurar
   lojas/afiliados e calcular comissões.
   --------------------------------------------------------- */
Object.defineProperties(window, {
  STORE_CONFIG: { get() { return STORE_CONFIG; }, configurable: true },
  STORE_META:   { get() { return STORE_META; },   configurable: true }
});
window.AFFILIATE_PARAM = AFFILIATE_PARAM;
window.COMMISSION_RATE = COMMISSION_RATE;
window.commissionRate = commissionRate;
window.refreshStoreConfig = refreshStoreConfig;
window.toast = toast;
