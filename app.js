// ===== STATE =====
const API_URL = window.location.origin + '/api';
let STORE = {};
let PRODUCTS = [];
let cart = (function() {
  const saved = localStorage.getItem('huios_cart_ts');
  if (saved && Date.now() - parseInt(saved) > 86400000) { localStorage.removeItem('huios_cart'); localStorage.removeItem('huios_cart_ts'); }
  return JSON.parse(localStorage.getItem('huios_cart') || '[]');
})();
let clienteToken = localStorage.getItem('huios_cliente_token') || '';
let clienteNome = localStorage.getItem('huios_cliente_nome') || '';
let selectedProduct = null;
let selectedSize = '';
let selectedColor = '';
let modalQty = 1;
let freteValue = 0;
let freteLabel = '';

// ===== INIT =====
async function init() {
  // Tentar API primeiro, fallback pro JSON
  let produtos = [];
  try {
    const r = await fetch(API_URL + '/produtos');
    produtos = await r.json();
  } catch(e) {}
  // Carregar config da loja do JSON
  const res = await fetch('produtos.json');
  const data = await res.json();
  STORE = data.loja;
  PRODUCTS = produtos.length ? produtos.map(p => ({...p, categoria: p.categoria, id: p.id})) : data.produtos;
  renderCategories(data.categorias);
  renderProducts(PRODUCTS);
  updateCartCount();
  const pixEl = document.getElementById('pixKey'); if (pixEl) pixEl.textContent = STORE.pix;
  document.getElementById('footerContact').innerHTML = `
    <a href="https://wa.me/${STORE.whatsapp}" target="_blank">WhatsApp</a>
    <a href="mailto:${STORE.email}">${STORE.email}</a>
  `;
  // Nav category clicks
  document.querySelectorAll('nav a[data-cat]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('nav a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      filterCat(a.dataset.cat);
      document.querySelector('nav').classList.remove('open');
    });
  });
}

// ===== RENDER =====
function renderCategories(cats) {
  const el = document.getElementById('categories');
  if (!el) return;
  el.innerHTML = `<div class="cat-pill active" onclick="filterCat('Todos')">Todos</div>` +
    cats.map(c => `<div class="cat-pill" onclick="filterCat('${c}')">${c}</div>`).join('');
}

function renderProducts(list) {
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = list.map(p => `
    <div class="product-card" onclick="openModal(${p.id})" style="position:relative;">
      ${p.destaque ? '<div class="badge-destaque">Destaque</div>' : ''}
      <div class="product-img">
        <img src="${p.imagem}" alt="${p.nome}" onerror="this.style.display='none';this.parentElement.textContent='📷';">
      </div>
      <div class="product-info">
        <div class="product-cat">${p.categoria}</div>
        <div class="product-name">${p.nome}</div>
        <div class="product-desc">${p.descricao}</div>
        <div class="product-price">R$ ${p.preco.toFixed(2).replace('.',',')} <small>ou 3x de R$ ${(p.preco/3).toFixed(2).replace('.',',')}</small></div>
      </div>
    </div>
  `).join('');
}

function filterCat(cat) {
  document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.cat-pill').forEach(p => { if(p.textContent === cat) p.classList.add('active'); });
  renderProducts(cat === 'Todos' ? PRODUCTS : PRODUCTS.filter(p => p.categoria === cat));
  document.getElementById('produtos').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===== MODAL =====
function openModal(id) {
  selectedProduct = PRODUCTS.find(p => p.id === id);
  if (!selectedProduct) return;
  selectedSize = selectedProduct.tamanhos[0] || '';
  selectedColor = selectedProduct.cores[0] || '';
  modalQty = 1;
  const m = document.getElementById('productModal');
  document.getElementById('modalCat').textContent = selectedProduct.categoria;
  document.getElementById('modalName').textContent = selectedProduct.nome;
  document.getElementById('modalDesc').textContent = selectedProduct.descricao;
  document.getElementById('modalPrice').textContent = `R$ ${selectedProduct.preco.toFixed(2).replace('.',',')}`;
  document.getElementById('modalQty').textContent = modalQty;
  // Image
  const imgEl = document.getElementById('modalImg');
  imgEl.innerHTML = `<img src="${selectedProduct.imagem}" alt="${selectedProduct.nome}" onerror="this.style.display='none';this.parentElement.textContent='📷';">`;
  // Sizes
  const sizesDiv = document.getElementById('modalSizes');
  const sizesOpts = document.getElementById('modalSizesOpts');
  if (selectedProduct.tamanhos.length > 0) {
    sizesDiv.style.display = 'block';
    sizesOpts.innerHTML = selectedProduct.tamanhos.map(s =>
      `<button class="opt-btn ${s===selectedSize?'selected':''}" onclick="selectSize('${s}')">${s}</button>`
    ).join('');
  } else { sizesDiv.style.display = 'none'; }
  // Colors
  const colorsOpts = document.getElementById('modalColorsOpts');
  colorsOpts.innerHTML = selectedProduct.cores.map(c =>
    `<button class="opt-btn ${c===selectedColor?'selected':''}" onclick="selectColor('${c}')">${c}</button>`
  ).join('');
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('productModal').classList.remove('open');
  document.body.style.overflow = '';
}

function selectSize(s) { selectedSize = s; document.querySelectorAll('#modalSizesOpts .opt-btn').forEach(b => b.classList.toggle('selected', b.textContent===s)); }
function selectColor(c) { selectedColor = c; document.querySelectorAll('#modalColorsOpts .opt-btn').forEach(b => b.classList.toggle('selected', b.textContent===c)); }
function changeQty(d) { modalQty = Math.max(1, modalQty + d); document.getElementById('modalQty').textContent = modalQty; }

// ===== CART =====
function addToCart() {
  if (!selectedProduct) return;
  const item = {
    id: selectedProduct.id,
    nome: selectedProduct.nome,
    preco: selectedProduct.preco,
    imagem: selectedProduct.imagem,
    tamanho: selectedSize,
    cor: selectedColor,
    qty: modalQty
  };
  const key = `${item.id}-${item.tamanho}-${item.cor}`;
  const existing = cart.find(c => `${c.id}-${c.tamanho}-${c.cor}` === key);
  if (existing) { existing.qty += modalQty; } else { cart.push(item); }
  saveCart();
  closeModal();
  showToast('Produto adicionado ao carrinho! 🛒');
}

function removeFromCart(idx) { cart.splice(idx, 1); saveCart(); renderCart(); }

function saveCart() { localStorage.setItem('huios_cart', JSON.stringify(cart)); localStorage.setItem('huios_cart_ts', Date.now().toString()); updateCartCount(); }
function updateCartCount() { document.getElementById('cartCount').textContent = cart.reduce((s,i) => s + i.qty, 0); }

function toggleCart() {
  const o = document.getElementById('cartOverlay');
  const p = document.getElementById('cartPanel');
  const isOpen = p.classList.contains('open');
  o.classList.toggle('open', !isOpen);
  p.classList.toggle('open', !isOpen);
  document.body.style.overflow = isOpen ? '' : 'hidden';
  if (!isOpen) renderCart();
}

function renderCart() {
  const el = document.getElementById('cartItems');
  const footer = document.getElementById('cartFooter');
  if (cart.length === 0) {
    el.innerHTML = '<div class="cart-empty">Seu carrinho está vazio</div>';
    footer.style.display = 'none';
    return;
  }
  footer.style.display = 'block';
  el.innerHTML = cart.map((item, i) => `
    <div class="cart-item">
      <div class="cart-item-img">
        <img src="${item.imagem}" alt="${item.nome}" onerror="this.style.display='none';this.parentElement.textContent='📷';">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.nome}</div>
        <div class="cart-item-meta">${item.tamanho ? item.tamanho+' · ' : ''}${item.cor} · Qtd: ${item.qty}</div>
        <div class="cart-item-price">R$ ${(item.preco * item.qty).toFixed(2).replace('.',',')}</div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${i})">🗑</button>
    </div>
  `).join('');
  const subtotal = cart.reduce((s,i) => s + i.preco * i.qty, 0);
  document.getElementById('cartTotal').textContent = `R$ ${(subtotal + freteValue).toFixed(2).replace('.',',')}`;
}

// ===== FRETE (Correios via ViaCEP + estimativa) =====
function maskCep(el) { el.value = el.value.replace(/\D/g,'').replace(/(\d{5})(\d)/,'$1-$2').slice(0,9); }

async function calcFrete() {
  const cep = document.getElementById('cepInput').value.replace(/\D/g,'');
  if (cep.length !== 8) { showToast('CEP inválido'); return; }
  const el = document.getElementById('freteResult');
  el.innerHTML = '<p>Calculando...</p>';
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const data = await res.json();
    if (data.erro) { el.innerHTML = '<p style="color:#f87171;">CEP não encontrado</p>'; return; }
    // Estimativa baseada na região
    const uf = data.uf;
    const rj = ['RJ'];
    const sudeste = ['SP','MG','ES'];
    const sul = ['PR','SC','RS'];
    let sedex, pac, diasSedex, diasPac;
    if (rj.includes(uf)) { sedex = 18.90; pac = 12.90; diasSedex = '2-3'; diasPac = '5-7'; }
    else if (sudeste.includes(uf)) { sedex = 24.90; pac = 16.90; diasSedex = '3-4'; diasPac = '7-10'; }
    else if (sul.includes(uf)) { sedex = 29.90; pac = 19.90; diasSedex = '4-5'; diasPac = '8-12'; }
    else { sedex = 39.90; pac = 24.90; diasSedex = '5-7'; diasPac = '10-15'; }
    // Frete grátis acima de R$200
    const subtotal = cart.reduce((s,i) => s + i.preco * i.qty, 0);
    const freeShipping = subtotal >= 200;
    el.innerHTML = `
      <p style="margin-bottom:4px;">${data.localidade} - ${data.uf}</p>
      <div class="frete-option" style="cursor:pointer;padding:8px;border-radius:8px;border:1px solid var(--border);margin:4px 0;" onclick="selectFrete(${pac},'PAC ${diasPac} dias')">
        📦 PAC (${diasPac} dias úteis) — <strong>${freeShipping ? 'GRÁTIS' : 'R$ '+pac.toFixed(2).replace('.',',')}</strong>
      </div>
      <div class="frete-option" style="cursor:pointer;padding:8px;border-radius:8px;border:1px solid var(--border);margin:4px 0;" onclick="selectFrete(${sedex},'SEDEX ${diasSedex} dias')">
        🚀 SEDEX (${diasSedex} dias úteis) — <strong>${freeShipping ? 'GRÁTIS' : 'R$ '+sedex.toFixed(2).replace('.',',')}</strong>
      </div>
      ${freeShipping ? '<p style="color:var(--success);font-weight:600;margin-top:8px;">🎉 Frete grátis acima de R$ 200!</p>' : '<p style="margin-top:6px;font-size:12px;">Frete grátis acima de R$ 200</p>'}
    `;
    if (freeShipping) { freteValue = 0; freteLabel = 'Grátis'; }
  } catch(e) { el.innerHTML = '<p style="color:#f87171;">Erro ao calcular frete</p>'; }
}

function selectFrete(val, label) {
  const subtotal = cart.reduce((s,i) => s + i.preco * i.qty, 0);
  freteValue = subtotal >= 200 ? 0 : val;
  freteLabel = label;
  document.getElementById('cartTotal').textContent = `R$ ${(subtotal + freteValue).toFixed(2).replace('.',',')}`;
  document.querySelectorAll('.frete-option').forEach(el => el.style.borderColor = 'var(--border)');
  event.currentTarget.style.borderColor = 'var(--accent)';
  showToast(`Frete selecionado: ${label}`);
}

// ===== CHECKOUT =====
async function goCheckout() {
  if (cart.length === 0) return;
  if (!clienteToken) {
    toggleCart();
    document.getElementById('loginGate').style.display = 'block';
    document.getElementById('checkoutSection').style.display = 'none';
    document.querySelector('.hero').style.display = 'none';
    document.getElementById('produtos').style.display = 'none';
    document.getElementById('loginGate').scrollIntoView({behavior:'smooth'});
    return;
  }
  toggleCart();
  document.getElementById('checkoutSection').style.display = 'block';
  document.getElementById('productos')?.style && (document.getElementById('productos').style.display = 'none');
  document.querySelector('.hero').style.display = 'none';
  document.getElementById('categories')?.parentElement && (document.getElementById('categories').parentElement.style.display = 'none');
  document.getElementById('produtos').style.display = 'none';
  // Auto-preencher se logado
  if (clienteToken) {
    try {
      const r = await fetch(API_URL+'/clientes/perfil', {headers:{'Authorization':'Bearer '+clienteToken}});
      if (r.ok) {
        const c = await r.json();
        document.getElementById('ckName').value = c.nome || '';
        document.getElementById('ckPhone').value = c.whatsapp || '';
        document.getElementById('ckEmail').value = c.email || '';
        document.getElementById('ckCep').value = c.cep || '';
        document.getElementById('ckCity').value = c.cidade || '';
        document.getElementById('ckAddress').value = c.endereco || '';
      }
    } catch(e) {}
  }
  // Render order summary
  const subtotal = cart.reduce((s,i) => s + i.preco * i.qty, 0);
  const total = subtotal + freteValue;
  let html = cart.map(i => `
    <div class="order-line">
      <span>${i.qty}x ${i.nome} ${i.tamanho?'('+i.tamanho+')':''} ${i.cor}</span>
      <span>R$ ${(i.preco*i.qty).toFixed(2).replace('.',',')}</span>
    </div>
  `).join('');
  html += `<div class="order-line"><span>Frete ${freteLabel||''}</span><span>${freteValue>0?'R$ '+freteValue.toFixed(2).replace('.',','):'Grátis'}</span></div>`;
  html += `<div class="order-line total"><span>Total</span><span style="color:var(--accent);">R$ ${total.toFixed(2).replace('.',',')}</span></div>`;
  document.getElementById('orderSummary').innerHTML = html;
  if (!document.getElementById('ckCep').value) document.getElementById('ckCep').value = document.getElementById('cepInput')?.value || '';
  document.getElementById('checkoutSection').scrollIntoView({ behavior: 'smooth' });
}

function copyPix() {
  navigator.clipboard.writeText(STORE.pix);
  showToast('Chave Pix copiada! ✅');
}

async function sendOrder() {
  const name = document.getElementById('ckName').value;
  const phone = document.getElementById('ckPhone').value;
  const email = document.getElementById('ckEmail').value;
  const cep = document.getElementById('ckCep').value;
  const city = document.getElementById('ckCity').value;
  const address = document.getElementById('ckAddress').value;
  if (!name || !phone || !address) { showToast('Preencha todos os campos obrigatórios'); return; }
  if (!freteLabel) { showToast('Selecione a forma de envio (calcule o frete)'); return; }
  const subtotal = cart.reduce((s,i) => s + i.preco * i.qty, 0);
  const total = subtotal + freteValue;
  const itens = cart.map(i => ({nome:i.nome, qty:i.qty, preco:i.preco, tamanho:i.tamanho||'', cor:i.cor||''}));
  // Salvar pedido na API
  let pedidoId = '';
  try {
    const pedido = { nome: name, whatsapp: phone, email, endereco: address, cep, cidade: city, itens, subtotal, frete: freteValue, total };
    const r = await fetch(API_URL+'/pedidos', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(pedido)});
    const d = await r.json();
    pedidoId = d.id || '';
  } catch(e) {}
  // Criar pagamento no Mercado Pago
  try {
    const mp = await fetch(API_URL+'/pagamento', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({itens, frete: freteValue, nome: name, email, pedido_id: pedidoId})});
    const mpData = await mp.json();
    if (mpData.init_point) {
      // Enviar resumo via WhatsApp
      let msg = `*Pedido Huios* 🛒 #${pedidoId}\n*Cliente:* ${name}\n*WhatsApp:* ${phone}\n*Total: R$ ${total.toFixed(2).replace('.',',')}*\nPagamento via Mercado Pago`;
      window.open(`https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
      // Redirecionar pro checkout MP
      window.location.href = mpData.init_point;
      cart = []; saveCart();
      return;
    }
  } catch(e) { console.log('MP erro, fallback pix', e); }
  // Fallback: Pix manual via WhatsApp
  let msg = `*Novo pedido Huios Store* 🛒${pedidoId ? ' #'+pedidoId : ''}\n\n`;
  msg += `*Cliente:* ${name}\n*WhatsApp:* ${phone}\n*Email:* ${email}\n\n`;
  msg += `*Endereço:*\n${address}\n${city} - CEP: ${cep}\n\n`;
  msg += `*Produtos:*\n`;
  cart.forEach(i => { msg += `• ${i.qty}x ${i.nome} ${i.tamanho?'('+i.tamanho+')':''} ${i.cor} — R$ ${(i.preco*i.qty).toFixed(2).replace('.',',')}\n`; });
  msg += `\n*Frete:* ${freteValue>0?'R$ '+freteValue.toFixed(2).replace('.',','):'Grátis'} ${freteLabel}\n`;
  msg += `*Total: R$ ${total.toFixed(2).replace('.',',')}*\n\n`;
  msg += `Pagamento via Pix: ${STORE.pix}`;
  window.open(`https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
  cart = []; saveCart();
  showToast('Pedido #' + (pedidoId||'') + ' registrado! Obrigado 🙏');
}

// ===== LOGIN GATE =====
async function gateDoLogin() {
  const email = document.getElementById('gateEmail').value, senha = document.getElementById('gateSenha').value;
  try {
    const r = await fetch(API_URL+'/clientes/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, senha})});
    if (!r.ok) throw new Error();
    const d = await r.json();
    clienteToken = d.token; clienteNome = d.nome;
    localStorage.setItem('huios_cliente_token', d.token);
    localStorage.setItem('huios_cliente_nome', d.nome);
    updateAccountUI();
    document.getElementById('loginGate').style.display = 'none';
    goCheckout();
  } catch(e) { document.getElementById('gateErr').textContent = 'Email ou senha inválidos'; }
}
async function gateDoRegistro() {
  const nome = document.getElementById('gateRegNome').value, email = document.getElementById('gateRegEmail').value;
  const whatsapp = document.getElementById('gateRegWhats').value, senha = document.getElementById('gateRegSenha').value;
  if (!nome || !email || !senha) { document.getElementById('gateRegErr').textContent = 'Preencha todos os campos'; return; }
  try {
    const r = await fetch(API_URL+'/clientes/registro', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nome, email, whatsapp, senha})});
    if (!r.ok) { const e = await r.json(); throw new Error(e.detail || 'Erro'); }
    const d = await r.json();
    clienteToken = d.token; clienteNome = d.nome;
    localStorage.setItem('huios_cliente_token', d.token);
    localStorage.setItem('huios_cliente_nome', d.nome);
    updateAccountUI();
    document.getElementById('loginGate').style.display = 'none';
    goCheckout();
  } catch(e) { document.getElementById('gateRegErr').textContent = e.message; }
}

// ===== TOAST =====
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

// ===== CLOSE MODAL ON ESC =====
document.addEventListener('keydown', e => { if(e.key==='Escape') { closeModal(); if(document.getElementById('cartPanel').classList.contains('open')) toggleCart(); document.getElementById('accountMenu').classList.remove('open'); }});
document.addEventListener('click', e => { const m = document.getElementById('accountMenu'); if(m.classList.contains('open') && !m.contains(e.target) && !e.target.classList.contains('account-btn')) m.classList.remove('open'); });

// ===== CONTA CLIENTE =====
function toggleAccountMenu() { document.getElementById('accountMenu').classList.toggle('open'); }
function showRegistro() { document.getElementById('accountLoggedOut').style.display='none'; document.getElementById('accountRegistro').style.display='block'; }
function showLogin() { document.getElementById('accountRegistro').style.display='none'; document.getElementById('accountLoggedOut').style.display='block'; }

async function clienteLogin() {
  const email = document.getElementById('accEmail').value, senha = document.getElementById('accSenha').value;
  try {
    const r = await fetch(API_URL+'/clientes/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, senha})});
    if (!r.ok) throw new Error();
    const d = await r.json();
    clienteToken = d.token; clienteNome = d.nome;
    localStorage.setItem('huios_cliente_token', d.token);
    localStorage.setItem('huios_cliente_nome', d.nome);
    updateAccountUI();
  } catch(e) { document.getElementById('accErr').textContent = 'Email ou senha inválidos'; }
}

async function clienteRegistro() {
  const nome = document.getElementById('regNome').value, email = document.getElementById('regEmail').value;
  const whatsapp = document.getElementById('regWhats').value, senha = document.getElementById('regSenha').value;
  if (!nome || !email || !senha) { document.getElementById('accErr').textContent = 'Preencha todos os campos'; return; }
  try {
    const r = await fetch(API_URL+'/clientes/registro', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({nome, email, whatsapp, senha})});
    if (r.status === 409) { document.getElementById('accErr').textContent = 'Email já cadastrado'; return; }
    if (!r.ok) throw new Error();
    const d = await r.json();
    clienteToken = d.token; clienteNome = d.nome;
    localStorage.setItem('huios_cliente_token', d.token);
    localStorage.setItem('huios_cliente_nome', d.nome);
    updateAccountUI();
    showToast('Conta criada com sucesso!');
  } catch(e) { document.getElementById('accErr').textContent = 'Erro ao cadastrar'; }
}

function clienteLogout() {
  clienteToken = ''; clienteNome = '';
  localStorage.removeItem('huios_cliente_token');
  localStorage.removeItem('huios_cliente_nome');
  updateAccountUI();
}

function updateAccountUI() {
  document.getElementById('accErr').textContent = '';
  if (clienteToken) {
    document.getElementById('accountLoggedOut').style.display = 'none';
    document.getElementById('accountRegistro').style.display = 'none';
    document.getElementById('accountLoggedIn').style.display = 'block';
    document.getElementById('accNome').textContent = 'Olá, ' + clienteNome + '!';
    document.getElementById('accountBtn').textContent = '👤';
    document.getElementById('accountBtn').style.color = '#e85d26';
  } else {
    document.getElementById('accountLoggedOut').style.display = 'block';
    document.getElementById('accountRegistro').style.display = 'none';
    document.getElementById('accountLoggedIn').style.display = 'none';
    document.getElementById('accountBtn').style.color = '';
  }
}

async function showMeusPedidos() {
  try {
    const r = await fetch(API_URL+'/clientes/pedidos', {headers:{'Authorization':'Bearer '+clienteToken}});
    const peds = await r.json();
    let html = '<h3 style="margin-bottom:12px">Meus Pedidos</h3>';
    if (!peds.length) html += '<p style="color:#888">Nenhum pedido ainda</p>';
    else peds.forEach(p => {
      html += `<div style="border:1px solid #2a2a2a;border-radius:8px;padding:12px;margin-bottom:8px">`;
      html += `<strong>#${p.id}</strong> — R$ ${p.total.toFixed(2).replace('.',',')} <span style="color:${p.status==='pendente'?'#fbbf24':'#4ade80'}">${p.status}</span>`;
      html += `<br><small style="color:#888">${new Date(p.created_at).toLocaleDateString('pt-BR')}</small></div>`;
    });
    document.getElementById('accountLoggedIn').innerHTML = html + '<button class="btn" style="width:100%;margin-top:8px;background:#1a1a1a;border:1px solid #2a2a2a;color:#f5f5f5" onclick="updateAccountUI()">Voltar</button>';
  } catch(e) {}
}

async function showPerfil() {
  try {
    const r = await fetch(API_URL+'/clientes/perfil', {headers:{'Authorization':'Bearer '+clienteToken}});
    const c = await r.json();
    let html = '<h3 style="margin-bottom:12px">Meu Perfil</h3>';
    html += `<input id="pfNome" value="${c.nome}" placeholder="Nome"><input id="pfWhats" value="${c.whatsapp||''}" placeholder="WhatsApp">`;
    html += `<input id="pfEnd" value="${c.endereco||''}" placeholder="Endereço"><input id="pfCep" value="${c.cep||''}" placeholder="CEP">`;
    html += `<input id="pfCid" value="${c.cidade||''}" placeholder="Cidade">`;
    html += `<button class="btn btn-primary" style="width:100%;margin-bottom:8px" onclick="salvarPerfil()">Salvar</button>`;
    html += `<button class="btn" style="width:100%;background:#1a1a1a;border:1px solid #2a2a2a;color:#f5f5f5" onclick="updateAccountUI()">Voltar</button>`;
    document.getElementById('accountLoggedIn').innerHTML = html;
  } catch(e) {}
}

async function salvarPerfil() {
  await fetch(API_URL+'/clientes/perfil', {method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+clienteToken},
    body: JSON.stringify({nome:document.getElementById('pfNome').value, whatsapp:document.getElementById('pfWhats').value,
      endereco:document.getElementById('pfEnd').value, cep:document.getElementById('pfCep').value, cidade:document.getElementById('pfCid').value})});
  clienteNome = document.getElementById('pfNome').value;
  localStorage.setItem('huios_cliente_nome', clienteNome);
  showToast('Perfil atualizado!');
  updateAccountUI();
}

// Init account state
if (clienteToken) updateAccountUI();

// ===== START =====
init();
