
/*** Simple Restaurant Ordering SPA — localStorage powered ***/

// ---------- Utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const fmt = (n) => SETTINGS.currency + (Math.round(n*100)/100).toFixed(2);
const id = () => Math.random().toString(36).slice(2,10);
const nowStr = () => new Date().toLocaleString();
const toast = (msg, t=1500) => { const n=$("#toast"); n.textContent=msg; n.classList.add("show"); setTimeout(()=>n.classList.remove("show"), t); };

// SHA-256 hashing (for demo auth)
async function sha256(str){
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

// ---------- Storage Layer ----------
const KEY = {
  CATS:"resto.categories",
  ITEMS:"resto.items",
  USERS:"resto.users",
  SETTINGS:"resto.settings",
  ORDERS:"resto.orders",
  SESSION:"resto.session",
  CART:"resto.cart"
};

function load(key, def){ try{ const v=localStorage.getItem(key); return v? JSON.parse(v): def; }catch(e){ return def; } }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// ---------- Initial Data ----------
function ensureSeed(){
  if (!load(KEY.SETTINGS)){
    save(KEY.SETTINGS, { name:"Fordee’s Grill", tax: 6.25, currency:"$", deliveryFee: 4.99 });
  }
  if (!load(KEY.CATS)){
    save(KEY.CATS, [
      {id:id(), name:"Burgers", order:1},
      {id:id(), name:"Sandwiches", order:2},
      {id:id(), name:"Fries & Sides", order:3},
      {id:id(), name:"Drinks", order:4},
      {id:id(), name:"Desserts", order:5}
    ]);
  }
  if (!load(KEY.ITEMS)){
    const [c1,c2,c3,c4,c5] = load(KEY.CATS,[]);
    save(KEY.ITEMS, [
      {id:id(), name:"Classic Burger", categoryId:c1.id, price:9.99, available:true, desc:"Beef patty, lettuce, tomato, house sauce.", image:"", options:[]},
      {id:id(), name:"Cheddar Bacon Burger", categoryId:c1.id, price:12.49, available:true, desc:"Thick-cut bacon & cheddar.", image:"", options:[]},
      {id:id(), name:"Grilled Chicken Sandwich", categoryId:c2.id, price:10.49, available:true, desc:"Marinated chicken breast, pickles, mayo.", image:"", options:[]},
      {id:id(), name:"Crispy Fries", categoryId:c3.id, price:3.99, available:true, desc:"Golden and crunchy.", image:"", options:[
        {id:id(), name:"Size", type:"single", required:true, choices:[{id:id(), name:"Small", delta:0, def:true},{id:id(), name:"Large", delta:1.5}]}
      ]},
      {id:id(), name:"Onion Rings", categoryId:c3.id, price:4.99, available:true, desc:"Beer-battered rings.", image:"", options:[]},
      {id:id(), name:"Soda", categoryId:c4.id, price:2.49, available:true, desc:"Coke, Diet Coke, Sprite.", image:"", options:[
        {id:id(), name:"Flavor", type:"single", required:true, choices:[{id:id(), name:"Coke", delta:0, def:true},{id:id(), name:"Diet Coke", delta:0},{id:id(), name:"Sprite", delta:0}]},
        {id:id(), name:"Size", type:"single", required:true, choices:[{id:id(), name:"16 oz", delta:0, def:true},{id:id(), name:"24 oz", delta:0.7}]}
      ]},
      {id:id(), name:"Chocolate Shake", categoryId:c5.id, price:4.79, available:true, desc:"Rich chocolate shake.", image:"", options:[]}
    ]);
  }
  if (!load(KEY.USERS)){
    (async () => {
      const adminHash = await sha256("Admin123!");
      const users = [
        {id:id(), role:"admin", email:"admin@demo.local", name:"Admin", passHash:adminHash}
      ];
      save(KEY.USERS, users);
    })();
  }
  if (!load(KEY.ORDERS)) save(KEY.ORDERS, []);
  if (!load(KEY.CART)) save(KEY.CART, {items:[], note:"", type:"pickup"});
}
ensureSeed();

// ---------- App State ----------
let CATEGORIES = load(KEY.CATS, []);
let ITEMS = load(KEY.ITEMS, []);
let USERS = load(KEY.USERS, []);
let ORDERS = load(KEY.ORDERS, []);
let SETTINGS = load(KEY.SETTINGS, {name:"Restaurant", tax:0, currency:"$", deliveryFee:0});
let SESSION = load(KEY.SESSION, null);
let CART = load(KEY.CART, {items:[], note:"", type:"pickup"});

function syncAll(){
  save(KEY.CATS, CATEGORIES);
  save(KEY.ITEMS, ITEMS);
  save(KEY.USERS, USERS);
  save(KEY.ORDERS, ORDERS);
  save(KEY.SETTINGS, SETTINGS);
  save(KEY.SESSION, SESSION);
  save(KEY.CART, CART);
}

// ---------- Rendering: Header / Toolbar ----------
function renderHeader(){
  $("#restoName").textContent = SETTINGS.name || "Restaurant";
  $("#restoNameFooter").textContent = SETTINGS.name || "Restaurant";
  $("#year").textContent = new Date().getFullYear();
  $("#authLabel").textContent = SESSION ? `Hi, ${SESSION.name.split(" ")[0]}` : "Sign In";
}
renderHeader();

// ---------- Categories Chips ----------
let activeCat = "all";
function renderChips(){
  const row = $("#chipRow");
  row.innerHTML = "";
  const all = document.createElement("button");
  all.className = "chip" + (activeCat==="all"?" active":"");
  all.textContent = "All";
  all.onclick = ()=>{activeCat="all"; renderMenu();};
  row.appendChild(all);
  CATEGORIES.sort((a,b)=>a.order-b.order).forEach(cat=>{
    const c = document.createElement("button");
    c.className = "chip" + (activeCat===cat.id?" active":"");
    c.textContent = cat.name;
    c.onclick = ()=>{activeCat=cat.id; renderMenu();};
    row.appendChild(c);
  });
}
renderChips();

// ---------- Menu ----------
function productVisible(p){
  if (!p.available) return false;
  if (activeCat!=="all" && p.categoryId!==activeCat) return false;
  const q = $("#searchInput").value.trim().toLowerCase();
  if (!q) return true;
  return [p.name, p.desc].join(" ").toLowerCase().includes(q);
}
function categoryName(id){ return (CATEGORIES.find(c=>c.id===id)||{name:""}).name; }

function renderMenu(){
  const list = $("#menuList");
  list.innerHTML = "";
  const filtered = ITEMS.filter(productVisible);
  if (!filtered.length){
    list.innerHTML = `<div class="card" style="grid-column:1/-1;padding:16px">No items match your filters.</div>`;
    return;
  }
  filtered.sort((a,b)=>{
    const ca = categoryName(a.categoryId).toLowerCase(), cb=categoryName(b.categoryId).toLowerCase();
    if (ca!==cb) return ca<cb?-1:1;
    return a.name.toLowerCase()<b.name.toLowerCase()?-1:1;
  }).forEach(p=>{
    const el = document.createElement("div");
    el.className = "item";
    const imgSrc = p.image || "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='160' height='120'><rect width='100%' height='100%' fill='%23131d29'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239fb3c8' font-family='Arial' font-size='14'>No Image</text></svg>`);
    el.innerHTML = `
      ${imgSrc}
      <div>
        <h4>${p.name}</h4>
        <div class="muted">${categoryName(p.categoryId)}</div>
        <div class="muted">${p.desc||""}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <div class="price">${fmt(p.price)}</div>
        <button class="btn small">Add</button>
      </div>
    `;
    el.querySelector(".btn").onclick = ()=> openItemModal(p.id);
    list.appendChild(el);
  });
}
renderMenu();

$("#searchInput").addEventListener("input", renderMenu);

// ---------- Cart ----------
function cartTotals(){
  let sub = 0;
  CART.items.forEach(it=> sub += (it.price + it.optionsTotal) * it.qty);
  const tax = sub * (SETTINGS.tax/100);
  const fee = CART.type==="delivery" ? SETTINGS.deliveryFee : 0;
  const total = sub + tax + fee;
  return {sub, tax, fee, total};
}
function renderCart(){
  $("#orderType").value = CART.type;
  const list = $("#cartList");
  list.innerHTML = "";
  if (!CART.items.length){
    list.innerHTML = `<div class="muted" style="padding:10px">Your cart is empty.</div>`;
  } else {
    CART.items.forEach((it, idx)=>{
      const row = document.createElement("div");
      row.className = "cart-line";
      row.innerHTML = `
        <div>
          <div><b>${it.name}</b></div>
          ${it.options?.length? `<div class='muted' style='font-size:12px'>${it.options.map(o=>`${o.name}: ${o.choice.name}`).join(", ")}</div>`:""}
        </div>
        <div class="qty">
          <button aria-label="Decrease" data-i="${idx}" data-d="-1">-</button>
          <span>${it.qty}</span>
          <button aria-label="Increase" data-i="${idx}" data-d="1">+</button>
        </div>
        <div><b>${fmt((it.price + it.optionsTotal) * it.qty)}</b></div>
      `;
      row.addEventListener("click", (e)=>{
        const btn = e.target.closest("button");
        if (!btn) return;
        const i = +btn.dataset.i, d = +btn.dataset.d;
        CART.items[i].qty = Math.max(1, CART.items[i].qty + d);
        save(KEY.CART, CART);
        renderCart(); updateCartBadge();
      });
      list.appendChild(row);
    });
  }
  const t = cartTotals();
  $("#cartTotals").innerHTML = `
    <div class="row">
      <div style="flex:1">Subtotal</div><div>${fmt(t.sub)}</div>
    </div>
    <div class="row">
      <div style="flex:1">Tax (${SETTINGS.tax}%)</div><div>${fmt(t.tax)}</div>
    </div>
    ${CART.type==="delivery" ? `<div class="row"><div style="flex:1">Delivery Fee</div><div>${fmt(t.fee)}</div></div>`:""}
    <hr class="sep"/>
    <div class="row"><div style="flex:1"><b>Total</b></div><div><b>${fmt(t.total)}</b></div></div>
  `;
}
function updateCartBadge(){ $("#cartCount").textContent = CART.items.reduce((s,it)=>s+it.qty,0); }
renderCart(); updateCartBadge();

$("#orderType").addEventListener("change", e=>{ CART.type = e.target.value; save(KEY.CART, CART); renderCart(); });
$("#btnClearCart").onclick = ()=>{ CART.items = []; save(KEY.CART, CART); renderCart(); updateCartBadge(); };
$("#btnCart").onclick = ()=>{ window.scrollTo({top:0,behavior:"smooth"}); };

// ---------- Item Modal ----------
let MODAL = { product:null, qty:1, choices:[], optionsTotal:0 };
function openItemModal(productId){
  MODAL.product = ITEMS.find(p=>p.id===productId);
  MODAL.qty = 1; MODAL.choices = []; MODAL.optionsTotal=0;

  $("#itemTitle").textContent = MODAL.product.name;
  $("#itemCat").textContent = categoryName(MODAL.product.categoryId);
  $("#itemDesc").textContent = MODAL.product.desc||"";
  $("#itemPrice").textContent = fmt(MODAL.product.price);
  $("#itemImg").src = MODAL.product.image || "data:image/svg+xml;utf8,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='150'><rect width='100%' height='100%' fill='%23131d29'/></svg>");
  $("#qtyVal").textContent = "1";
  $("#qtyMinus").onclick = ()=>{ MODAL.qty = Math.max(1, MODAL.qty-1); $("#qtyVal").textContent = MODAL.qty; updateItemTotal(); };
  $("#qtyPlus").onclick = ()=>{ MODAL.qty++; $("#qtyVal").textContent = MODAL.qty; updateItemTotal(); };

  // Render options
  const wrap = $("#optWrap");
  wrap.innerHTML = "";
  (MODAL.product.options||[]).forEach(opt=>{
    const sec = document.createElement("div"); sec.style.marginTop="8px";
    sec.innerHTML = `<div><b>${opt.name}${opt.required? " *": ""}</b></div>`;
    if (opt.type==="single"){
      const sel = document.createElement("select");
      sel.style.marginTop="6px";
      opt.choices.forEach(ch=>{
        const o = document.createElement("option");
        o.value = ch.id; o.textContent = `${ch.name}${ch.delta? ` (${fmt(ch.delta)})`:""}`;
        if (ch.def) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = updateItemTotal;
      sec.appendChild(sel);
    }
    wrap.appendChild(sec);
  });
  updateItemTotal();
  $("#itemOverlay").classList.add("show");
}
function updateItemTotal(){
  // capture choices
  MODAL.choices = [];
  let add = 0;
  const selects = Array.from($("#optWrap").querySelectorAll("select"));
  selects.forEach((sel, idx)=>{
    const opt = MODAL.product.options[idx];
    const choice = opt.choices.find(c=>c.id===sel.value) || opt.choices[0];
    MODAL.choices.push({ name:opt.name, choice });
    add += choice.delta||0;
  });
  MODAL.optionsTotal = add;
  $("#itemTotal").textContent = fmt((MODAL.product.price + add) * MODAL.qty);
}
$("#btnCloseItem").onclick = ()=> $("#itemOverlay").classList.remove("show");
$("#btnAddToCart").onclick = ()=>{
  const item = {
    pid: MODAL.product.id,
    name: MODAL.product.name,
    price: MODAL.product.price,
    options: MODAL.choices,
    optionsTotal: MODAL.optionsTotal,
    qty: MODAL.qty
  };
  CART.items.push(item);
  save(KEY.CART, CART);
  $("#itemOverlay").classList.remove("show");
  renderCart(); updateCartBadge();
  toast("Added to cart");
};

// ---------- Checkout ----------
$("#btnCheckout").onclick = async ()=>{
  if (!CART.items.length){ toast("Your cart is empty."); return; }
  if (!SESSION){ $("#authOverlay").classList.add("show"); setAuthMode("signin"); toast("Sign in to place order"); return; }
  const t = cartTotals();
  const order = {
    id: Date.now(),
    at: nowStr(),
    customer: { id: SESSION.id, name: SESSION.name, email: SESSION.email },
    type: CART.type,
    items: CART.items,
    totals: t
  };
  ORDERS.push(order);
  save(KEY.ORDERS, ORDERS);
  CART.items = []; save(KEY.CART, CART);
  renderCart(); updateCartBadge();
  toast(`Order placed! Total ${fmt(t.total)}`);
};

// ---------- Auth (customer) ----------
let AUTH_MODE = "signin";
function setAuthMode(m){
  AUTH_MODE = m;
  $("#authTitle").textContent = m==="signin" ? "Sign In" : "Create Account";
  $("#toggleAuthMode").textContent = m==="signin" ? "Need an account? Sign Up" : "Have an account? Sign In";
  $("#nameRow").style.display = m==="signin" ? "none" : "flex";
}
$("#btnAuth").onclick = ()=> { $("#authOverlay").classList.add("show"); setAuthMode("signin"); };
$("#btnAuthCancel").onclick = ()=> $("#authOverlay").classList.remove("show");
$("#toggleAuthMode").onclick = ()=> setAuthMode(AUTH_MODE==="signin"?"signup":"signin");
$("#btnAuthConfirm").onclick = async ()=>{
  const email = $("#authEmail").value.trim().toLowerCase();
  const pass = $("#authPass").value;
  if (!email || !pass){ toast("Enter email & password"); return; }
  if (AUTH_MODE==="signin"){
    const u = USERS.find(x=>x.email===email);
    if (!u){ toast("User not found"); return; }
    const ph = await sha256(pass);
    if (u.passHash !== ph){ toast("Incorrect password"); return; }
    SESSION = { id:u.id, email:u.email, name:u.name, role:u.role };
    save(KEY.SESSION, SESSION);
    $("#authOverlay").classList.remove("show");
    renderHeader();
    toast("Signed in");
  } else {
    const name = $("#authName").value.trim();
    if (!name){ toast("Enter your name"); return; }
    if (USERS.some(x=>x.email===email)){ toast("Email already used"); return; }
    const ph = await sha256(pass);
    const u = { id:id(), role:"user", email, name, passHash:ph };
    USERS.push(u); save(KEY.USERS, USERS);
    SESSION = { id:u.id, email:u.email, name:u.name, role:u.role };
    save(KEY.SESSION, SESSION);
    $("#authOverlay").classList.remove("show");
    renderHeader();
    toast("Account created");
  }
};

// ---------- Admin Auth & App ----------
let ADMIN_OK = false;
$("#btnAdmin").onclick = ()=> { $("#adminOverlay").classList.add("show"); $("#adminGate").style.display="block"; $("#adminApp").style.display="none"; };
$("#btnAdminCancel").onclick = ()=> $("#adminOverlay").classList.remove("show");
$("#btnAdminLogin").onclick = async ()=>{
  const email = $("#adminEmail").value.trim().toLowerCase();
  const pass = $("#adminPass").value;
  const u = USERS.find(x=>x.email===email && x.role==="admin");
  if (!u){ toast("Admin not found"); return; }
  const ph = await sha256(pass);
  if (u.passHash !== ph){ toast("Wrong password"); return; }
  ADMIN_OK = true;
  $("#adminGate").style.display="none"; $("#adminApp").style.display="block";
  openAdminTab("items"); hydrateAdmin();
};
$("#btnAdminLogout").onclick = ()=>{ ADMIN_OK=false; $("#adminOverlay").classList.remove("show"); };
$("#btnCloseAdmin").onclick = ()=> $("#adminOverlay").classList.remove("show");

// Tabs
$("#adminTabs").addEventListener("click", e=>{
  const t = e.target.closest(".tab"); if (!t) return;
  $$(".tab").forEach(x=>x.classList.remove("active")); t.classList.add("active");
  openAdminTab(t.dataset.tab);
});
function openAdminTab(name){
  $$(".admin-panel").forEach(p=>p.style.display="none");
  $("#tab-"+name).style.display="block";
  if (name==="items") renderAdminItems();
  if (name==="categories") renderAdminCats();
  if (name==="orders") renderAdminOrders();
  if (name==="settings") renderAdminSettings();
  if (name==="users") renderAdminUsers();
}
function hydrateAdmin(){ renderAdminItems(); renderAdminCats(); renderAdminOrders(); renderAdminSettings(); renderAdminUsers(); }

// ---- Admin: Items
function renderAdminItems(){
  const tb = $("#itemsTable tbody"); tb.innerHTML="";
  ITEMS.forEach(p=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><img src="${p.image || 'path/to/placeholder/image.png'}" alt="Product Image" /></td>
      <td contenteditable="true" data-f="name">${p.name}</td>
      <td>
        <select data-f="categoryId">${CATEGORIES.map(c=>`<option value="${c.id}" ${c.id===p.categoryId?"selected":""}>${c.name}</option>`).join("")}</select>
      </td>
      <td><input data-f="price" type="number" min="0" step="0.01" value="${p.price}"/></td>
      <td><input data-f="available" type="checkbox" ${p.available?"checked":""}/></td>
      <td>
        <label class="btn small">Upload<input type="file" accept="image/*" style="display:none" data-f="imageFile"/></label>
        <button class="btn small danger" data-act="del">Delete</button>
      </td>
    `;
    tr.addEventListener("input", async (e)=>{
      const f = e.target.dataset.f;
      if (!f) return;
      if (f==="name") p.name = e.target.textContent.trim();
      if (f==="price") p.price = parseFloat(e.target.value||0);
      if (f==="categoryId") p.categoryId = e.target.value;
      if (f==="available") p.available = e.target.checked;
      save(KEY.ITEMS, ITEMS); renderMenu();
    });
    tr.addEventListener("change", async (e)=>{
      const f = e.target.dataset.f;
      if (f==="imageFile"){
        const file = e.target.files[0];
        if (!file) return;
        const b64 = await fileToDataURL(file);
        p.image = b64; save(KEY.ITEMS, ITEMS); renderMenu(); renderAdminItems();
      }
    });
    tr.querySelector("[data-act='del']").onclick = ()=>{
      if (!confirm(`Delete ${p.name}?`)) return;
      ITEMS = ITEMS.filter(x=>x.id!==p.id); save(KEY.ITEMS, ITEMS); renderMenu(); renderAdminItems();
    };
    tb.appendChild(tr);
  });
}
$("#btnAddItem").onclick = ()=>{
  if (!CATEGORIES.length){ toast("Add a category first"); return; }
  const p = { id:id(), name:"New Item", categoryId:CATEGORIES[0].id, price:0, available:true, desc:"", image:"", options:[] };
  ITEMS.push(p); save(KEY.ITEMS, ITEMS); renderMenu(); renderAdminItems();
};
function fileToDataURL(file){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

// ---- Admin: Categories
function renderAdminCats(){
  const tb = $("#catTable tbody"); tb.innerHTML="";
  CATEGORIES.sort((a,b)=>a.order-b.order).forEach(c=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td contenteditable="true" data-f="name">${c.name}</td>
      <td><input data-f="order" type="number" value="${c.order}" style="width:90px"/></td>
      <td><button class="btn small danger" data-act="del">Delete</button></td>
    `;
    tr.addEventListener("input", (e)=>{
      const f = e.target.dataset.f;
      if (f==="name") c.name = e.target.textContent.trim();
      if (f==="order") c.order = parseInt(e.target.value||0);
      save(KEY.CATS, CATEGORIES); renderChips(); renderMenu();
    });
    tr.querySelector("[data-act='del']").onclick = ()=>{
      if (ITEMS.some(p=>p.categoryId===c.id)){ toast("Move or delete items in this category first"); return; }
      CATEGORIES = CATEGORIES.filter(x=>x.id!==c.id); save(KEY.CATS, CATEGORIES); renderChips(); renderAdminCats(); renderMenu();
    };
    tb.appendChild(tr);
  });
}
$("#btnAddCat").onclick = ()=>{
  const c = { id:id(), name:"New Category", order: (Math.max(0,...CATEGORIES.map(x=>x.order))+1) || 1 };
  CATEGORIES.push(c); save(KEY.CATS, CATEGORIES); renderChips(); renderAdminCats();
};

// ---- Admin: Orders
function renderAdminOrders(){
  const tb = $("#ordersTable tbody"); tb.innerHTML="";
  ORDERS.slice().reverse().forEach((o,idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${ORDERS.length-idx}</td>
      <td>${o.at}</td>
      <td>${o.customer.name} (${o.customer.email})</td>
      <td>${o.type}</td>
      <td>${fmt(o.totals.total)}</td>
      <td>${o.items.map(i=>`${i.qty}× ${i.name}`).join(", ")}</td>
    `;
    tb.appendChild(tr);
  });
}
$("#btnClearOrders").onclick = ()=>{ if (!confirm("Clear all orders?")) return; ORDERS=[]; save(KEY.ORDERS, ORDERS); renderAdminOrders(); };

// ---- Admin: Settings
function renderAdminSettings(){
  $("#setName").value = SETTINGS.name||"";
  $("#setTax").value = SETTINGS.tax||0;
  $("#setCurrency").value = SETTINGS.currency||"$";
  $("#setDelivery").value = SETTINGS.deliveryFee||0;
}
$("#btnSaveSettings").onclick = ()=>{
  SETTINGS.name = $("#setName").value.trim()||"Restaurant";
  SETTINGS.tax = parseFloat($("#setTax").value||0);
  SETTINGS.currency = $("#setCurrency").value||"$";
  SETTINGS.deliveryFee = parseFloat($("#setDelivery").value||0);
  save(KEY.SETTINGS, SETTINGS);
  renderHeader(); renderCart();
  toast("Settings saved");
};

// ---- Admin: Users
function renderAdminUsers(){
  const tb = $("#usersTable tbody"); tb.innerHTML="";
  USERS.forEach(u=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td contenteditable="true" data-f="name">${u.name}</td>
      <td contenteditable="true" data-f="email">${u.email}</td>
      <td>
        <select data-f="role">
          <option value="user" ${u.role==="user"?"selected":""}>user</option>
          <option value="admin" ${u.role==="admin"?"selected":""}>admin</option>
        </select>
      </td>
      <td>
        <button class="btn small" data-act="reset">Reset Password</button>
        ${USERS.length>1? `<button class="btn small danger" data-act="del">Delete</button>`:""}
      </td>
    `;
    tr.addEventListener("input", (e)=>{
      const f = e.target.dataset.f;
      if (f==="name") u.name = e.target.textContent.trim();
      if (f==="email") u.email = e.target.textContent.trim().toLowerCase();
      save(KEY.USERS, USERS);
    });
    tr.addEventListener("change", (e)=>{
      const f = e.target.dataset.f;
      if (f==="role"){ u.role = e.target.value; save(KEY.USERS, USERS); }
    });
    tr.querySelector("[data-act='reset']").onclick = async ()=>{
      const p = prompt("Enter a new password for " + u.email);
      if (!p) return;
      u.passHash = await sha256(p); save(KEY.USERS, USERS); toast("Password updated");
    };
    const del = tr.querySelector("[data-act='del']");
    if (del) del.onclick = ()=>{
      if (!confirm("Delete user?")) return;
      USERS = USERS.filter(x=>x.id!==u.id); save(KEY.USERS, USERS); renderAdminUsers();
    };
    tb.appendChild(tr);
  });
}
$("#btnAddUser").onclick = async ()=>{
  const email = prompt("Email"); if (!email) return;
  if (USERS.some(u=>u.email===email.toLowerCase())){ toast("Email already exists"); return; }
  const name = prompt("Name") || "User";
  const pass = prompt("Temporary password") || Math.random().toString(36).slice(2,8);
  const passHash = await sha256(pass);
  USERS.push({id:id(), role:"user", email:email.toLowerCase(), name, passHash});
  save(KEY.USERS, USERS); renderAdminUsers();
  alert(`User created.\nEmail: ${email}\nTemp password: ${pass}`);
};

// ---------- Session ----------
$("#authLabel").onclick = ()=>{
  if (SESSION){
    if (confirm("Sign out?")){ SESSION=null; save(KEY.SESSION, SESSION); renderHeader(); toast("Signed out"); }
  } else {
    $("#authOverlay").classList.add("show");
    setAuthMode("signin");
  }
};

// ---------- Open Status (demo) ----------
function updateOpenBadge(){
  const now = new Date();
  const h = now.getHours();
  const open = h>=11 && h<=21;
  const b = $("#openBadge");
  b.textContent = open ? "Open" : "Closed";
  b.style.background = open ? "linear-gradient(180deg,#8dcccc,#9cdbc9)" : "linear-gradient(180deg,#cc8566,#db997f)";
}
updateOpenBadge();
setInterval(updateOpenBadge, 60000);