/* =========================================================
   Central de Promoções — Área do Dono
   Painel de Configurações (⚙️) + Dashboard de Analytics (📊)
   Tudo persistido em localStorage. Sem backend.
   ========================================================= */
(function () {
  "use strict";

  const $ = sel => document.querySelector(sel);
  const BRL = n => "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* -------------------------------------------------------
     PROTEÇÃO LEVE POR PIN (somente dono)
     Num site estático não há login real. O PIN fica salvo no
     navegador do dono e evita que a área abra por acidente.
     ------------------------------------------------------- */
  const PIN_KEY = "se_owner_pin";
  function hasPin() { return !!localStorage.getItem(PIN_KEY); }
  function checkPin(pin) { return localStorage.getItem(PIN_KEY) === pin; }
  function setPin(pin) { localStorage.setItem(PIN_KEY, pin); }

  // Gate: pede o PIN (ou cria, na primeira vez). Retorna true se liberar.
  function ownerGate() {
    if (!hasPin()) {
      const novo = prompt("Primeira vez na área do dono.\nCrie um PIN de acesso (guarde-o):");
      if (!novo) return false;
      setPin(novo.trim());
      alert("PIN criado. Guarde-o: só você deve ter acesso a esta área.");
      return true;
    }
    const tent = prompt("Área do dono — digite seu PIN:");
    if (tent === null) return false;
    if (checkPin(tent.trim())) return true;
    alert("PIN incorreto.");
    return false;
  }

  /* -------------------------------------------------------
     ANALYTICS — coleta de eventos
     events: [{ type, id, name, store, price, qty, ts }]
     type ∈ "click" | "cart" | "purchase"
     ------------------------------------------------------- */
  const EV_KEY = "se_events";
  function loadEvents() {
    try { return JSON.parse(localStorage.getItem(EV_KEY)) || []; } catch { return []; }
  }
  function saveEvents(ev) { localStorage.setItem(EV_KEY, JSON.stringify(ev)); }

  // Exposto para o script.js via ponte window.__track
  window.__track = function (type, payload) {
    const ev = loadEvents();
    ev.push(Object.assign({ type, ts: Date.now() }, payload || {}));
    saveEvents(ev);
    // se o dashboard estiver aberto, atualiza em tempo real
    if ($("#analyticsOverlay") && $("#analyticsOverlay").classList.contains("open")) renderAnalytics();
  };

  function clearEvents() {
    if (confirm("Limpar TODOS os dados de analytics? Esta ação não pode ser desfeita.")) {
      saveEvents([]);
      renderAnalytics();
    }
  }

  // Helpers de agregação
  function commissionRate(store) {
    return (typeof window.commissionRate === "function") ? window.commissionRate(store) : 0.05;
  }
  function storeLabel(store) {
    const meta = (window.STORE_META || {})[store];
    return meta ? meta.label : store;
  }
  function storeColor(store) {
    const meta = (window.STORE_META || {})[store];
    return meta ? meta.color : "#888";
  }

  function aggregate(events) {
    const totals = { click: 0, cart: 0, purchase: 0, sales: 0, commission: 0 };
    const byStore = {};
    events.forEach(e => {
      if (e.type === "click") totals.click++;
      if (e.type === "cart") totals.cart++;
      if (e.type === "purchase") {
        totals.purchase++;
        totals.sales += Number(e.price || 0);
        totals.commission += Number(e.price || 0) * commissionRate(e.store);
      }
      const s = (byStore[e.store] = byStore[e.store] || { click: 0, cart: 0, purchase: 0, sales: 0, commission: 0 });
      if (e.type === "click") s.click++;
      if (e.type === "cart") s.cart++;
      if (e.type === "purchase") { s.purchase++; s.sales += Number(e.price || 0); s.commission += Number(e.price || 0) * commissionRate(e.store); }
    });
    return { totals, byStore };
  }

  /* -------------------------------------------------------
     DASHBOARD — render
     ------------------------------------------------------- */
  let analyticsTab = "overview";

  function renderAnalytics() {
    const events = loadEvents();
    const { totals, byStore } = aggregate(events);
    const body = $("#analyticsBody");
    if (!body) return;

    if (analyticsTab === "overview") body.innerHTML = overviewHTML(totals, events);
    else if (analyticsTab === "stores") body.innerHTML = storesHTML(byStore);
    else body.innerHTML = historyHTML(events);
  }

  function kpi(icon, label, value) {
    return `<div class="kpi"><div class="kpi__icon">${icon}</div><div class="kpi__val">${value}</div><div class="kpi__label">${label}</div></div>`;
  }

  function overviewHTML(t, events) {
    const rate = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    // funil
    const funnel = `
      <div class="funnel">
        <div class="funnel__step"><span>🔗 Cliques</span><strong>${t.click}</strong></div>
        <div class="funnel__arrow">→ ${rate(t.cart, t.click)}%</div>
        <div class="funnel__step"><span>🛒 Carrinho</span><strong>${t.cart}</strong></div>
        <div class="funnel__arrow">→ ${rate(t.purchase, t.cart)}%</div>
        <div class="funnel__step is-end"><span>✅ Compras</span><strong>${t.purchase}</strong></div>
      </div>`;

    return `
      <div class="kpis">
        ${kpi("🔗", "Cliques Totais", t.click)}
        ${kpi("🛒", "Adições ao Carrinho", t.cart)}
        ${kpi("✅", "Compras Efetuadas", t.purchase)}
        ${kpi("💰", "Valor Total em Vendas", BRL(t.sales))}
        ${kpi("🤑", "Comissão Estimada", BRL(t.commission))}
      </div>
      <h4 class="dash__h">🔄 Funil de Conversão</h4>
      ${funnel}
      <h4 class="dash__h">📅 Atividade (últimos 14 dias)</h4>
      ${chart14HTML(events)}`;
  }

  function chart14HTML(events) {
    const days = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0, 0, 0, 0);
      days.push({ d, count: 0, label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) });
    }
    events.forEach(e => {
      const ed = new Date(e.ts); ed.setHours(0, 0, 0, 0);
      const slot = days.find(x => x.d.getTime() === ed.getTime());
      if (slot) slot.count++;
    });
    const max = Math.max(1, ...days.map(x => x.count));
    const bars = days.map(x => `
      <div class="bar" title="${x.label}: ${x.count} evento(s)">
        <div class="bar__fill" style="height:${Math.round((x.count / max) * 100)}%"></div>
        <span class="bar__lbl">${x.label.slice(0, 2)}</span>
      </div>`).join("");
    return `<div class="chart">${bars}</div>`;
  }

  function storesHTML(byStore) {
    const keys = Object.keys(byStore);
    const rate = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
    const cards = keys.length
      ? keys.map(k => `
        <div class="store-card">
          <div class="store-card__head"><span class="dot" style="background:${storeColor(k)}"></span>${storeLabel(k)}</div>
          <div class="store-card__grid">
            <div><small>Cliques</small><b>${byStore[k].click}</b></div>
            <div><small>Carrinho</small><b>${byStore[k].cart}</b></div>
            <div><small>Compras</small><b>${byStore[k].purchase}</b></div>
            <div><small>Vendas</small><b>${BRL(byStore[k].sales)}</b></div>
            <div><small>Comissão</small><b>${BRL(byStore[k].commission)}</b></div>
            <div><small>Conversão</small><b>${rate(byStore[k].purchase, byStore[k].click)}%</b></div>
          </div>
        </div>`).join("")
      : `<p class="dash__empty">Ainda não há dados por loja. Interaja com a loja para gerar eventos.</p>`;

    // tabela de taxas de referência
    const rateRows = Object.entries(window.COMMISSION_RATE || {})
      .filter(([k]) => k !== "_default")
      .map(([k, v]) => `<tr><td>${storeLabel(k)}</td><td>${Math.round(v * 100)}%</td></tr>`).join("");

    return `
      <div class="store-cards">${cards}</div>
      <h4 class="dash__h">Taxas de comissão de referência</h4>
      <table class="rate-table"><thead><tr><th>Loja</th><th>Comissão</th></tr></thead><tbody>${rateRows}</tbody></table>
      <p class="dash__note">Taxas aproximadas, apenas para estimativa. Confirme os valores reais no painel de cada programa de afiliados.</p>`;
  }

  function historyHTML(events) {
    if (!events.length) return `<p class="dash__empty">Nenhum evento registrado ainda.</p>`;
    const icon = { click: "🔗", cart: "🛒", purchase: "✅" };
    const tname = { click: "Clique", cart: "Carrinho", purchase: "Compra" };
    const rows = events.slice().reverse().map(e => {
      const dt = new Date(e.ts).toLocaleString("pt-BR");
      return `
        <div class="hist-row">
          <span class="hist-type">${icon[e.type] || "•"} ${tname[e.type] || e.type}</span>
          <span class="hist-prod">${e.name || "-"}</span>
          <span class="hist-store"><span class="dot" style="background:${storeColor(e.store)}"></span>${storeLabel(e.store)}</span>
          <span class="hist-price">${BRL(e.price)}</span>
          <span class="hist-date">${dt}</span>
        </div>`;
    }).join("");
    return `
      <div class="hist-head">
        <span>${events.length} evento(s)</span>
        <button class="dash__clear" id="clearEventsBtn">🗑️ Limpar todos os dados</button>
      </div>
      <div class="hist-list">${rows}</div>`;
  }

  /* -------------------------------------------------------
     CONFIGURAÇÕES — render
     ------------------------------------------------------- */
  const GUIDES = [
    { store: "Amazon",        url: "https://associados.amazon.com.br",        note: "Programa Amazon Associados. Use sua tag (ex.: meusite-21)." },
    { store: "Shopee",        url: "https://affiliate.shopee.com.br",         note: "Programa Shopee Afiliados." },
    { store: "Mercado Livre", url: "https://publicidade.mercadolivre.com.br", note: "Mercado Livre — programa de afiliados/publicidade." }
  ];

  function renderConfig() {
    const cfg = window.STORE_CONFIG || {};
    const body = $("#configBody");
    if (!body) return;

    const storeBlocks = Object.entries(cfg).map(([key, s]) => {
      if (s.locked) {
        return `
          <div class="cfg-store">
            <div class="cfg-store__head">
              <span class="cfg-store__name"><span class="dot" style="background:${s.color}"></span>${s.emoji || ""} ${s.label}</span>
              <span class="cfg-locked">loja própria</span>
            </div>
            <p class="cfg-hint">Esta é a sua loja — não precisa de afiliado.</p>
          </div>`;
      }
      const link = sampleLink(key, s);
      return `
        <div class="cfg-store" data-store="${key}">
          <div class="cfg-store__head">
            <span class="cfg-store__name"><span class="dot" style="background:${s.color}"></span>${s.emoji || ""} ${s.label}</span>
            <label class="switch">
              <input type="checkbox" class="cfg-enabled" ${s.enabled !== false ? "checked" : ""} />
              <span>${s.enabled !== false ? "Ativa" : "Inativa"}</span>
            </label>
          </div>
          <label class="cfg-field">
            <span>Tag de afiliado</span>
            <input type="text" class="cfg-affiliate" value="${attr(s.affiliate)}" placeholder="ex.: meusite-21" />
          </label>
          <label class="cfg-field">
            <span>URL template de busca</span>
            <input type="text" class="cfg-search" value="${attr(s.search)}" placeholder="https://loja.com/busca?q=" />
          </label>
          <div class="cfg-preview">
            <small>Preview do link:</small>
            <a href="${link}" target="_blank" rel="noopener noreferrer" class="cfg-preview__link">${link || "(defina a URL template)"}</a>
          </div>
          ${s.custom ? `<button class="cfg-remove" data-remove="${key}">Remover loja</button>` : ""}
        </div>`;
    }).join("");

    const guides = GUIDES.map(g => `
      <li><strong>${g.store}</strong> → <a href="${g.url}" target="_blank" rel="noopener noreferrer">${g.url.replace("https://", "")}</a><br><small>${g.note}</small></li>
    `).join("");

    body.innerHTML = `
      <section class="cfg-section">
        <h4 class="dash__h">🔐 Segurança</h4>
        <button class="cfg-btn-sm" id="changePinBtn">Alterar PIN de acesso</button>
      </section>

      <section class="cfg-section">
        <h4 class="dash__h">🔗 Links de Afiliado por Loja</h4>
        <div class="cfg-stores">${storeBlocks}</div>
      </section>

      <section class="cfg-section">
        <h4 class="dash__h">➕ Adicionar Nova Loja</h4>
        <div class="cfg-add">
          <input type="text" id="newKey" placeholder="id (ex.: aliexpress)" />
          <input type="text" id="newLabel" placeholder="Nome (ex.: AliExpress)" />
          <input type="text" id="newEmoji" placeholder="Emoji (ex.: 🛒)" maxlength="4" />
          <input type="color" id="newColor" value="#8A2BE2" title="Cor" />
          <input type="text" id="newSearch" placeholder="URL de busca (https://...?q=)" />
          <button class="btn btn--buy" id="addStoreBtn">Adicionar</button>
        </div>
        <p class="cfg-hint">Ex.: AliExpress, Magalu, Casas Bahia. A nova loja aparece na comparação de preços.</p>
      </section>

      <section class="cfg-section">
        <h4 class="dash__h">📖 Guia de Cadastro nos Programas</h4>
        <ul class="cfg-guide">${guides}</ul>
      </section>

      <div class="cfg-actions">
        <button class="btn btn--buy btn--block" id="saveConfigBtn">💾 Salvar configurações</button>
      </div>`;
  }

  function attr(v) { return String(v == null ? "" : v).replace(/"/g, "&quot;"); }

  function sampleLink(key, s) {
    if (!s.search) return "";
    const param = (window.AFFILIATE_PARAM || {})[key] || "aff";
    let url = s.search + encodeURIComponent("exemplo de produto");
    if (s.affiliate) {
      const sep = url.includes("?") ? "&" : "?";
      url += `${sep}${param}=${encodeURIComponent(s.affiliate)}`;
    }
    return url;
  }

  // Salva o que está nos campos de volta ao localStorage.
  function saveConfigFromForm() {
    const cfg = JSON.parse(JSON.stringify(window.STORE_CONFIG || {}));
    document.querySelectorAll(".cfg-store[data-store]").forEach(block => {
      const key = block.dataset.store;
      if (!cfg[key]) return;
      cfg[key].affiliate = block.querySelector(".cfg-affiliate").value.trim();
      cfg[key].search = block.querySelector(".cfg-search").value.trim();
      cfg[key].enabled = block.querySelector(".cfg-enabled").checked;
    });
    localStorage.setItem("se_stores", JSON.stringify(cfg));
    if (typeof window.refreshStoreConfig === "function") window.refreshStoreConfig();
    renderConfig();
    flash("Configurações salvas!");
  }

  function addStore() {
    const key = ($("#newKey").value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const label = ($("#newLabel").value || "").trim();
    const emoji = ($("#newEmoji").value || "🏷️").trim();
    const color = $("#newColor").value || "#8A2BE2";
    const search = ($("#newSearch").value || "").trim();
    if (!key || !label || !search) { alert("Preencha pelo menos id, nome e URL de busca."); return; }

    const cfg = JSON.parse(localStorage.getItem("se_stores") || "{}");
    const base = JSON.parse(JSON.stringify(window.STORE_CONFIG || {}));
    const merged = Object.assign(base, cfg);
    if (merged[key]) { alert("Já existe uma loja com esse id."); return; }
    merged[key] = { label, color, emoji, search, affiliate: "", enabled: true, custom: true };
    localStorage.setItem("se_stores", JSON.stringify(merged));
    if (typeof window.refreshStoreConfig === "function") window.refreshStoreConfig();
    renderConfig();
    flash(`Loja "${label}" adicionada!`);
  }

  function removeStore(key) {
    if (!confirm("Remover esta loja?")) return;
    const cfg = JSON.parse(localStorage.getItem("se_stores") || "{}");
    delete cfg[key];
    localStorage.setItem("se_stores", JSON.stringify(cfg));
    if (typeof window.refreshStoreConfig === "function") window.refreshStoreConfig();
    renderConfig();
    flash("Loja removida.");
  }

  function changePin() {
    const atual = prompt("Digite seu PIN atual:");
    if (atual === null) return;
    if (!checkPin(atual.trim())) { alert("PIN atual incorreto."); return; }
    const novo = prompt("Novo PIN:");
    if (!novo) return;
    setPin(novo.trim());
    alert("PIN alterado.");
  }

  function flash(msg) {
    if (typeof window.toast === "function") window.toast(msg);
    else alert(msg);
  }

  /* -------------------------------------------------------
     Abrir / fechar painéis
     ------------------------------------------------------- */
  function openConfig() { if (!ownerGate()) return; renderConfig(); $("#configOverlay").classList.add("open"); }
  function closeConfig() { $("#configOverlay").classList.remove("open"); }
  function openAnalytics() { if (!ownerGate()) return; analyticsTab = "overview"; syncTabs(); renderAnalytics(); $("#analyticsOverlay").classList.add("open"); }
  function closeAnalytics() { $("#analyticsOverlay").classList.remove("open"); }

  function syncTabs() {
    document.querySelectorAll(".dash-tab").forEach(t => t.classList.toggle("is-active", t.dataset.tab === analyticsTab));
  }

  /* -------------------------------------------------------
     Ligação de eventos
     ------------------------------------------------------- */
  function bind() {
    $("#ownerConfigBtn") && $("#ownerConfigBtn").addEventListener("click", openConfig);
    $("#ownerAnalyticsBtn") && $("#ownerAnalyticsBtn").addEventListener("click", openAnalytics);

    // Config overlay
    $("#configClose") && $("#configClose").addEventListener("click", closeConfig);
    $("#configOverlay") && $("#configOverlay").addEventListener("click", e => { if (e.target === $("#configOverlay")) closeConfig(); });
    $("#configBody") && $("#configBody").addEventListener("click", e => {
      if (e.target.closest("#saveConfigBtn")) return saveConfigFromForm();
      if (e.target.closest("#addStoreBtn")) return addStore();
      if (e.target.closest("#changePinBtn")) return changePin();
      const rem = e.target.closest("[data-remove]");
      if (rem) return removeStore(rem.dataset.remove);
    });
    // preview em tempo real
    $("#configBody") && $("#configBody").addEventListener("input", e => {
      const block = e.target.closest(".cfg-store[data-store]");
      if (!block) return;
      const key = block.dataset.store;
      const link = block.querySelector(".cfg-preview__link");
      const fakeStore = {
        search: block.querySelector(".cfg-search").value.trim(),
        affiliate: block.querySelector(".cfg-affiliate").value.trim()
      };
      const url = sampleLink(key, fakeStore);
      if (link) { link.textContent = url || "(defina a URL template)"; link.href = url || "#"; }
      // atualiza rótulo do switch
      const sw = block.querySelector(".switch span");
      if (sw && e.target.classList.contains("cfg-enabled")) sw.textContent = e.target.checked ? "Ativa" : "Inativa";
    });

    // Analytics overlay
    $("#analyticsClose") && $("#analyticsClose").addEventListener("click", closeAnalytics);
    $("#analyticsOverlay") && $("#analyticsOverlay").addEventListener("click", e => { if (e.target === $("#analyticsOverlay")) closeAnalytics(); });
    document.querySelectorAll(".dash-tab").forEach(t => t.addEventListener("click", () => {
      analyticsTab = t.dataset.tab; syncTabs(); renderAnalytics();
    }));
    $("#analyticsBody") && $("#analyticsBody").addEventListener("click", e => {
      if (e.target.closest("#clearEventsBtn")) clearEvents();
    });

    document.addEventListener("keydown", e => { if (e.key === "Escape") { closeConfig(); closeAnalytics(); } });
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
