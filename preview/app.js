/* Vytrex Panel — SPA logic (FA/EN/AR/RU) */
const $ = (s, r = document) => r.querySelector(s);
let STATE = { settings:{}, inbounds:[], outbounds:[], nodes:[], stats:{} };
let ONLINE = {};
let LANG = localStorage.getItem("vx_lang") || "fa";
let THEME = localStorage.getItem("vx_theme") || "dark";
let CUR = "overview";
let monTimer = null;

const RTL = ["fa", "ar"];
const LANGS = [["fa","فارسی"],["en","English"],["ar","العربية"],["ru","Русский"]];

const T = {
  fa:{welcome:"خوش آمدید 👋", username:"نام کاربری", password:"رمز عبور", signin:"ورود", logout:"خروج",
    overview:"داشبورد", inbounds:"اینباند", outbounds:"اوت‌باند", clients:"کاربران", nodes:"نودها", settings:"تنظیمات", logs:"لاگ‌ها",
    inboundsN:"اینباند", clientsN:"کاربر", traffic:"کل ترافیک", xray:"Xray", running:"فعال", stopped:"متوقف",
    cpu:"پردازنده", ram:"حافظه", disk:"دیسک", uptime:"آپتایم", online:"آنلاین", offline:"آفلاین", net:"شبکه",
    addInbound:"+ اینباند", addClient:"+ کاربر", addOutbound:"+ اوت‌باند", addNode:"+ نود",
    edit:"ویرایش", del:"حذف", save:"ذخیره", cancel:"انصراف",
    remark:"نام", protocol:"پروتکل", network:"شبکه", security:"امنیت", port:"پورت", enabled:"فعال",
    path:"مسیر", host:"هاست", serviceName:"نام سرویس gRPC", sni:"SNI", mode:"حالت (xhttp)",
    dest:"مقصد Reality", serverNames:"Server Names", genkeys:"تولید کلید Reality",
    email:"نام کاربر (خالی=خودکار)", secret:"UUID/رمز (خالی=خودکار)", quota:"حجم (GB، ۰=نامحدود)", expiry:"انقضا",
    ipLimit:"محدودیت IP (۰=نامحدود)", links:"لینک‌ها", sub:"لینک اشتراک", infoPage:"صفحهٔ کاربر", qr:"QR",
    copy:"کپی", copied:"کپی شد", saved:"ذخیره شد", reloaded:"Xray ری‌لود شد",
    used:"مصرف", unlimited:"نامحدود", noItems:"موردی نیست", confirmDel:"حذف شود؟",
    serverAddr:"آدرس سرور", theme:"تم", lang:"زبان", newPass:"رمز جدید (خالی=بدون تغییر)",
    saveSettings:"ذخیرهٔ تنظیمات", reload:"ری‌لود Xray", showLinks:"لینک/QR", back:"بازگشت",
    panelPort:"پورت پنل", panelPortHint:"بعد از تغییر پورت: systemctl restart vytrex-panel", tgBot:"ربات تلگرام",
    tgBotHint:"توکن ربات را از @BotFather بگیر و آیدی عددی ادمین‌ها را وارد کن. کاربران با /link و توکن اشتراکشان وارد می‌شوند.",
    botToken:"توکن ربات", botAdmins:"آیدی عددی ادمین‌ها", configured:"تنظیم‌شده", antiFilter:"ضدفیلتر و استتار",
    antiFilterHint:"Reality با xtls-rprx-vision قوی‌ترین ترنسپورت فعلی است. برای کمترین شانس فیلتر: IP تمیز، dest/SNI معتبر (microsoft/cloudflare) و کانفیگ خصوصی. فرگمنت یک قابلیت سمت اپلیکیشن کلاینت است.",
    location:"لوکیشن", address:"آدرس/IP", apiUrl:"آدرس API", secretK:"کلید امن", addqta:"+حجم", ips:"IPها",
    outSettings:"تنظیمات (JSON)", quickAdd:"افزودن سریع" },
  en:{welcome:"Welcome back 👋", username:"Username", password:"Password", signin:"Sign in", logout:"Logout",
    overview:"Overview", inbounds:"Inbounds", outbounds:"Outbounds", clients:"Clients", nodes:"Nodes", settings:"Settings", logs:"Logs",
    inboundsN:"Inbounds", clientsN:"Clients", traffic:"Total Traffic", xray:"Xray", running:"Running", stopped:"Stopped",
    cpu:"CPU", ram:"RAM", disk:"Disk", uptime:"Uptime", online:"Online", offline:"Offline", net:"Network",
    addInbound:"+ Inbound", addClient:"+ Client", addOutbound:"+ Outbound", addNode:"+ Node",
    edit:"Edit", del:"Delete", save:"Save", cancel:"Cancel",
    remark:"Remark", protocol:"Protocol", network:"Network", security:"Security", port:"Port", enabled:"Enabled",
    path:"Path", host:"Host", serviceName:"gRPC service", sni:"SNI", mode:"Mode (xhttp)",
    dest:"Reality dest", serverNames:"Server Names", genkeys:"Generate Reality keys",
    email:"Client name (blank=auto)", secret:"UUID/password (blank=auto)", quota:"Quota (GB, 0=∞)", expiry:"Expiry",
    ipLimit:"IP limit (0=unlimited)", links:"Links", sub:"Subscription URL", infoPage:"User page", qr:"QR",
    copy:"Copy", copied:"Copied", saved:"Saved", reloaded:"Xray reloaded",
    used:"Used", unlimited:"Unlimited", noItems:"No items", confirmDel:"Delete?",
    serverAddr:"Server address", theme:"Theme", lang:"Language", newPass:"New password (blank=keep)",
    saveSettings:"Save settings", reload:"Reload Xray", showLinks:"Links/QR", back:"Back",
    panelPort:"Panel port", panelPortHint:"After changing the port: systemctl restart vytrex-panel", tgBot:"Telegram bot",
    tgBotHint:"Get a token from @BotFather and add admin numeric chat IDs. Users join with /link and their subscription token.",
    botToken:"Bot token", botAdmins:"Admin chat IDs", configured:"configured", antiFilter:"Anti-filter & camouflage",
    antiFilterHint:"Reality with xtls-rprx-vision is the strongest transport available today. For the lowest blocking odds: a clean IP, a reputable dest/SNI (microsoft/cloudflare) and private configs. Fragment is a client-app feature.",
    location:"Location", address:"Address/IP", apiUrl:"API URL", secretK:"Secret", addqta:"+Data", ips:"IPs",
    outSettings:"Settings (JSON)", quickAdd:"Quick add" },
  ar:{welcome:"مرحباً بعودتك 👋", username:"اسم المستخدم", password:"كلمة المرور", signin:"دخول", logout:"خروج",
    overview:"لوحة", inbounds:"واردة", outbounds:"صادرة", clients:"المستخدمون", nodes:"العُقد", settings:"الإعدادات", logs:"السجلات",
    inboundsN:"واردة", clientsN:"مستخدم", traffic:"إجمالي الترافيك", xray:"Xray", running:"يعمل", stopped:"متوقف",
    cpu:"المعالج", ram:"الذاكرة", disk:"القرص", uptime:"مدة التشغيل", online:"متصل", offline:"غير متصل", net:"الشبكة",
    addInbound:"+ واردة", addClient:"+ مستخدم", addOutbound:"+ صادرة", addNode:"+ عقدة",
    edit:"تعديل", del:"حذف", save:"حفظ", cancel:"إلغاء",
    remark:"الاسم", protocol:"البروتوكول", network:"الشبكة", security:"الأمان", port:"المنفذ", enabled:"مفعّل",
    path:"المسار", host:"المضيف", serviceName:"اسم خدمة gRPC", sni:"SNI", mode:"الوضع",
    dest:"وجهة Reality", serverNames:"أسماء الخوادم", genkeys:"توليد مفاتيح Reality",
    email:"اسم المستخدم (فارغ=تلقائي)", secret:"UUID/كلمة (فارغ=تلقائي)", quota:"الحجم (GB، 0=∞)", expiry:"الانتهاء",
    ipLimit:"حد IP (0=غير محدود)", links:"الروابط", sub:"رابط الاشتراك", infoPage:"صفحة المستخدم", qr:"QR",
    copy:"نسخ", copied:"تم النسخ", saved:"تم الحفظ", reloaded:"تم تحديث Xray",
    used:"مستخدم", unlimited:"غير محدود", noItems:"لا شيء", confirmDel:"حذف؟",
    serverAddr:"عنوان الخادم", theme:"الثيم", lang:"اللغة", newPass:"كلمة مرور جديدة (فارغ=إبقاء)",
    saveSettings:"حفظ الإعدادات", reload:"تحديث Xray", showLinks:"روابط/QR", back:"رجوع",
    panelPort:"منفذ اللوحة", panelPortHint:"بعد تغيير المنفذ: systemctl restart vytrex-panel", tgBot:"بوت تيليجرام",
    tgBotHint:"احصل على التوكن من @BotFather وأضف معرفات المشرفين الرقمية. يدخل المستخدمون عبر /link ورمز اشتراكهم.",
    botToken:"توكن البوت", botAdmins:"معرفات المشرفين", configured:"مُهيأ", antiFilter:"مقاومة الحجب والتمويه",
    antiFilterHint:"Reality مع xtls-rprx-vision هو الأقوى حالياً. لأقل احتمال حجب: IP نظيف، وdest/SNI موثوق (microsoft/cloudflare)، وإعدادات خاصة. التجزئة (Fragment) ميزة في تطبيق العميل.",
    location:"الموقع", address:"العنوان/IP", apiUrl:"رابط API", secretK:"المفتاح", addqta:"+حجم", ips:"عناوين IP",
    outSettings:"الإعدادات (JSON)", quickAdd:"إضافة سريعة" },
  ru:{welcome:"С возвращением 👋", username:"Логин", password:"Пароль", signin:"Войти", logout:"Выход",
    overview:"Обзор", inbounds:"Входящие", outbounds:"Исходящие", clients:"Клиенты", nodes:"Узлы", settings:"Настройки", logs:"Логи",
    inboundsN:"Входящие", clientsN:"Клиенты", traffic:"Всего трафика", xray:"Xray", running:"Работает", stopped:"Остановлен",
    cpu:"ЦП", ram:"ОЗУ", disk:"Диск", uptime:"Аптайм", online:"Онлайн", offline:"Оффлайн", net:"Сеть",
    addInbound:"+ Входящий", addClient:"+ Клиент", addOutbound:"+ Исходящий", addNode:"+ Узел",
    edit:"Изменить", del:"Удалить", save:"Сохранить", cancel:"Отмена",
    remark:"Название", protocol:"Протокол", network:"Сеть", security:"Безопасность", port:"Порт", enabled:"Вкл",
    path:"Путь", host:"Хост", serviceName:"gRPC сервис", sni:"SNI", mode:"Режим",
    dest:"Reality dest", serverNames:"Server Names", genkeys:"Ключи Reality",
    email:"Имя (пусто=авто)", secret:"UUID/пароль (пусто=авто)", quota:"Объём (ГБ, 0=∞)", expiry:"Истекает",
    ipLimit:"Лимит IP (0=безлимит)", links:"Ссылки", sub:"Ссылка подписки", infoPage:"Страница", qr:"QR",
    copy:"Копир.", copied:"Скопировано", saved:"Сохранено", reloaded:"Xray перезапущен",
    used:"Исп.", unlimited:"Безлимит", noItems:"Пусто", confirmDel:"Удалить?",
    serverAddr:"Адрес сервера", theme:"Тема", lang:"Язык", newPass:"Новый пароль (пусто=оставить)",
    saveSettings:"Сохранить", reload:"Перезапуск Xray", showLinks:"Ссылки/QR", back:"Назад",
    panelPort:"Порт панели", panelPortHint:"После смены порта: systemctl restart vytrex-panel", tgBot:"Телеграм-бот",
    tgBotHint:"Получите токен у @BotFather и добавьте числовые ID админов. Пользователи входят через /link со своим токеном подписки.",
    botToken:"Токен бота", botAdmins:"ID администраторов", configured:"настроен", antiFilter:"Антиблокировка и маскировка",
    antiFilterHint:"Reality с xtls-rprx-vision — сильнейший транспорт на сегодня. Для минимума блокировок: чистый IP, надёжный dest/SNI (microsoft/cloudflare) и приватные конфиги. Fragment — функция клиентского приложения.",
    location:"Локация", address:"Адрес/IP", apiUrl:"API URL", secretK:"Секрет", addqta:"+Объём", ips:"IP",
    outSettings:"Настройки (JSON)", quickAdd:"Быстро" },
};
const t = (k) => (T[LANG] && T[LANG][k]) || k;

const NETWORKS = ["tcp","ws","grpc","httpupgrade","xhttp"];
const PROTOCOLS = ["vless","vmess","trojan"];
const SECURITIES = ["none","tls","reality"];
const TABS = ["overview","inbounds","outbounds","clients","nodes","settings","logs"];

function toast(m){ const e=$("#toast"); e.textContent=m; e.classList.add("show"); setTimeout(()=>e.classList.remove("show"),1700); }
function copy(x){ navigator.clipboard.writeText(x).then(()=>toast(t("copied"))); }
function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function fmtB(n){ n=Number(n)||0; const u=["B","KB","MB","GB","TB"]; let i=0; while(n>=1024&&i<u.length-1){n/=1024;i++;} return n.toFixed(i&&n<10?2:0)+" "+u[i]; }
function gb(b){ return Number(b||0)/1073741824; }
function toBytes(g){ return Math.round(Number(g||0)*1073741824); }
function fmtUptime(s){ s=Number(s)||0; const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60); return (d?d+"d ":"")+h+"h "+m+"m"; }

async function api(path, opts={}){
  const r = await fetch("/api/"+path, Object.assign({headers:{"content-type":"application/json"}}, opts));
  if(r.status===401){ showLogin(); throw new Error("unauth"); }
  const ct=r.headers.get("content-type")||"";
  return ct.includes("json") ? r.json() : r.text();
}

function fillLangSel(id){
  const s=$(id); if(!s) return;
  s.innerHTML=LANGS.map(([v,n])=>`<option value="${v}" ${v===LANG?"selected":""}>${n}</option>`).join("");
  s.onchange=()=>setLang(s.value);
}
function applyChrome(){
  document.documentElement.setAttribute("data-theme", THEME);
  document.documentElement.dir = RTL.includes(LANG) ? "rtl":"ltr";
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach(e=>e.textContent=t(e.getAttribute("data-i18n")));
  fillLangSel("#langSel"); fillLangSel("#loginLangSel");
}
function setLang(l){ LANG=l; localStorage.setItem("vx_lang",l); applyChrome(); if(!$("#app").hidden) render(); }
function setTheme(x){ THEME=x; localStorage.setItem("vx_theme",x); applyChrome(); }

/* ---------- auth ---------- */
function showLogin(){ stopMon(); $("#app").hidden=true; $("#login").hidden=false; }
async function doLogin(){
  const r = await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({username:$("#lg_user").value, password:$("#lg_pass").value})});
  if(r.ok){ $("#login").hidden=true; $("#app").hidden=false; await load(); }
  else { $("#lg_err").textContent = ({fa:"نام کاربری یا رمز اشتباه است",en:"Invalid credentials",ar:"بيانات خاطئة",ru:"Неверные данные"})[LANG]; }
}
async function doLogout(){ await api("logout",{method:"POST"}).catch(()=>{}); showLogin(); }

/* ---------- load ---------- */
async function load(){
  try{
    STATE = await api("state");
    $("#verlbl").textContent = "panel v"+(STATE.version||"");
    $("#app").hidden=false; $("#login").hidden=true;
    render();
  }catch(e){}
}
function renderTabs(){
  $("#tabs").innerHTML = TABS.map(id=>`<button class="tab ${id===CUR?"active":""}" data-tab="${id}">${t(id)}</button>`).join("");
  $("#tabs").querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
}
function switchTab(id){ stopMon(); CUR=id; document.querySelectorAll(".view").forEach(v=>v.hidden=true); $("#v-"+id).hidden=false; renderTabs(); renderCurrent(); }
function render(){ applyChrome(); renderTabs(); renderCurrent(); }
function renderCurrent(){ ({overview:renderOverview,inbounds:renderInbounds,outbounds:renderOutbounds,clients:renderClients,nodes:renderNodes,settings:renderSettings,logs:renderLogs}[CUR])(); }

/* ---------- overview + system monitor ---------- */
function stopMon(){ if(monTimer){ clearInterval(monTimer); monTimer=null; } }
function ring(pct,label,sub){
  return `<div class="gauge"><div class="ring" style="--p:${pct}"><div class="in">${pct}%</div></div>
    <div class="l">${label}</div><div class="sub">${sub||""}</div></div>`;
}
function renderOverview(){
  const s=STATE.stats||{};
  $("#v-overview").innerHTML = `
    <div class="grid g4">
      <div class="stat"><div class="v">${s.inbounds||0}</div><div class="l">${t("inboundsN")}</div></div>
      <div class="stat"><div class="v">${s.clients||0}</div><div class="l">${t("clientsN")}</div></div>
      <div class="stat"><div class="v">${fmtB(s.total_traffic||0)}</div><div class="l">${t("traffic")}</div></div>
      <div class="stat"><div class="v">${s.xray_running?"●":"○"}</div><div class="l">${t("xray")}: ${s.xray_running?t("running"):t("stopped")}</div></div>
    </div>
    <div class="card"><div class="between"><h3 style="margin:0">${t("cpu")} / ${t("ram")} / ${t("disk")}</h3>
      <button class="btn sm" id="reloadBtn">${t("reload")}</button></div>
      <div class="monitor" id="monitor"><p class="mut">…</p></div></div>`;
  $("#reloadBtn").onclick=async()=>{ const r=await api("reload",{method:"POST"}); toast(r.ok?t("reloaded"):("error")); };
  pollMon(); monTimer=setInterval(pollMon,3000);
}
async function pollMon(){
  let m; try{ m=await api("system"); }catch(e){ return; }
  const box=$("#monitor"); if(!box) return;
  box.innerHTML = ring(Math.round(m.cpu||0), t("cpu"), (m.cores||1)+" cores · load "+(m.load?m.load[0].toFixed(2):"-"))
    + ring(Math.round(m.mem?.percent||0), t("ram"), fmtB(m.mem?.used)+" / "+fmtB(m.mem?.total))
    + ring(Math.round(m.disk?.percent||0), t("disk"), fmtB(m.disk?.used)+" / "+fmtB(m.disk?.total))
    + `<div class="gauge"><div class="ring" style="--p:0"><div class="in">↑↓</div></div>
        <div class="l">${t("net")}</div><div class="sub">↓${fmtB(m.net?.rx)}/s ↑${fmtB(m.net?.tx)}/s<br>${t("uptime")}: ${fmtUptime(m.uptime)}</div></div>`;
}

/* ---------- inbounds ---------- */
function renderInbounds(){
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("inbounds")}</h3>
    <button class="btn sm" onclick="inboundModal()">${t("addInbound")}</button></div></div>`;
  if(!STATE.inbounds.length) h+=`<p class="mut">${t("noItems")}</p>`;
  STATE.inbounds.forEach(inb=>{
    h+=`<div class="item"><div class="between">
      <div><b>${esc(inb.remark||inb.tag)}</b> <span class="badge ${inb.enabled?"on":"off"}">${inb.enabled?t("enabled"):"off"}</span></div>
      <div class="row">
        <button class="btn ghost sm" onclick='inboundModal(${JSON.stringify(inb).replace(/'/g,"&#39;")})'>${t("edit")}</button>
        <button class="btn bad sm" onclick="delInbound(${inb.id})">${t("del")}</button></div></div>
      <div class="row" style="margin-top:8px"><span class="pill">${inb.protocol}</span><span class="pill">${inb.network}</span>
        <span class="pill">${inb.security}</span><span class="pill">:${inb.port}</span>
        <span class="mut">${(inb.clients||[]).length} ${t("clientsN")}</span></div></div>`;
  });
  $("#v-inbounds").innerHTML=h;
}
async function delInbound(id){ if(!confirm(t("confirmDel")))return; await api("inbounds/"+id,{method:"DELETE"}); toast(t("saved")); await load(); }
function inboundModal(inb){
  inb = inb || {protocol:"vless",network:"ws",security:"tls",port:443,enabled:true,stream:{}};
  const st=inb.stream||{};
  const sel=(id,opts,val)=>`<select id="${id}">${opts.map(o=>`<option ${o===val?"selected":""}>${o}</option>`).join("")}</select>`;
  openModal(`<h3>${inb.id?t("edit"):t("addInbound")}</h3>
    <label>${t("remark")}</label><input id="in_remark" value="${esc(inb.remark||"")}">
    <div class="grid g2">
      <div><label>${t("protocol")}</label>${sel("in_protocol",PROTOCOLS,inb.protocol)}</div>
      <div><label>${t("network")}</label>${sel("in_network",NETWORKS,inb.network)}</div>
      <div><label>${t("security")}</label>${sel("in_security",SECURITIES,inb.security)}</div>
      <div><label>${t("port")}</label><input id="in_port" type="number" value="${inb.port||443}"></div></div>
    <label>${t("path")}</label><input id="in_path" value="${esc(st.path||"/")}">
    <label>${t("host")}</label><input id="in_host" value="${esc(st.host||"")}">
    <label>${t("serviceName")}</label><input id="in_service" value="${esc(st.serviceName||"vytrex")}">
    <label>${t("sni")}</label><input id="in_sni" value="${esc(st.sni||"")}">
    <label>${t("mode")}</label><input id="in_mode" value="${esc(st.mode||"auto")}">
    <label>${t("serverNames")}</label><input id="in_snames" value="${esc((st.serverNames||["www.microsoft.com"]).join(","))}">
    <label>${t("dest")}</label><input id="in_dest" value="${esc(st.dest||"www.microsoft.com:443")}">
    <input id="in_pk" type="hidden" value="${esc(st.privateKey||"")}"><input id="in_pub" type="hidden" value="${esc(st.publicKey||"")}">
    <input id="in_sid" type="hidden" value="${esc((st.shortIds||[]).join(","))}">
    <div class="row" style="margin-top:10px"><button class="btn ghost sm" onclick="genReality()">${t("genkeys")}</button>
      <span class="mut" id="in_keyinfo">${st.publicKey?("pbk="+st.publicKey.slice(0,10)+"…"):""}</span></div>
    <label class="row" style="margin-top:12px"><input type="checkbox" id="in_enabled" style="width:auto" ${inb.enabled?"checked":""}> ${t("enabled")}</label>
    <div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveInbound("${inb.id||""}")'>${t("save")}</button></div>`);
}
async function genReality(){ const k=await api("genkeys"); $("#in_pk").value=k.privateKey;$("#in_pub").value=k.publicKey;$("#in_sid").value=k.shortId;
  $("#in_keyinfo").textContent=k.publicKey?("pbk="+k.publicKey.slice(0,12)+"…"):"xray not installed"; }
async function saveInbound(id){
  const stream={ path:$("#in_path").value, host:$("#in_host").value, serviceName:$("#in_service").value,
    sni:$("#in_sni").value, mode:$("#in_mode").value,
    serverNames:$("#in_snames").value.split(",").map(s=>s.trim()).filter(Boolean), dest:$("#in_dest").value,
    privateKey:$("#in_pk").value, publicKey:$("#in_pub").value,
    shortIds:$("#in_sid").value.split(",").map(s=>s.trim()).filter(Boolean) };
  const body={ id:id||undefined, remark:$("#in_remark").value, protocol:$("#in_protocol").value,
    network:$("#in_network").value, security:$("#in_security").value, port:+$("#in_port").value,
    enabled:$("#in_enabled").checked, stream };
  const r=await api("inbounds",{method:"POST",body:JSON.stringify(body)}); closeModal(); toast(r.reload?t("reloaded"):t("saved")); await load();
}

/* ---------- outbounds ---------- */
function renderOutbounds(){
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("outbounds")}</h3>
    <button class="btn sm" onclick="outboundModal()">${t("addOutbound")}</button></div>
    <p class="mut">direct + blocked ${LANG==="fa"?"به‌صورت پیش‌فرض فعال‌اند":"are built-in"}.</p></div>`;
  (STATE.outbounds||[]).forEach(o=>{
    h+=`<div class="item"><div class="between"><div><b>${esc(o.tag)}</b> <span class="pill">${o.protocol}</span></div>
      <div class="row"><button class="btn ghost sm" onclick='outboundModal(${JSON.stringify(o).replace(/'/g,"&#39;")})'>${t("edit")}</button>
      <button class="btn bad sm" onclick="delOutbound(${o.id})">${t("del")}</button></div></div></div>`;
  });
  if(!(STATE.outbounds||[]).length) h+=`<p class="mut">${t("noItems")}</p>`;
  $("#v-outbounds").innerHTML=h;
}
function outboundModal(o){
  o=o||{tag:"",protocol:"freedom",settings:{}};
  let settings = typeof o.settings==="string" ? o.settings : JSON.stringify(o.settings||{},null,2);
  openModal(`<h3>${o.id?t("edit"):t("addOutbound")}</h3>
    <label>Tag</label><input id="ob_tag" value="${esc(o.tag||"")}" placeholder="warp / proxy">
    <label>${t("protocol")}</label><input id="ob_proto" value="${esc(o.protocol||"freedom")}" placeholder="freedom / socks / vless / wireguard">
    <label>${t("outSettings")}</label><textarea id="ob_settings" style="min-height:120px;font-family:monospace">${esc(settings)}</textarea>
    <div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveOutbound("${o.id||""}")'>${t("save")}</button></div>`);
}
async function saveOutbound(id){
  let settings={}; try{ settings=JSON.parse($("#ob_settings").value||"{}"); }catch(e){ toast("JSON error"); return; }
  const r=await api("outbounds",{method:"POST",body:JSON.stringify({id:id||undefined,tag:$("#ob_tag").value,protocol:$("#ob_proto").value,settings})});
  closeModal(); toast(r.reload?t("reloaded"):t("saved")); await load();
}
async function delOutbound(id){ if(!confirm(t("confirmDel")))return; await api("outbounds/"+id,{method:"DELETE"}); toast(t("saved")); await load(); }

/* ---------- clients ---------- */
async function renderClients(){
  try{ ONLINE=(await api("online")).online||{}; }catch(e){ ONLINE={}; }
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("clients")}</h3>
    <button class="btn sm" onclick="clientModal()">${t("addClient")}</button></div></div>`;
  let any=false;
  STATE.inbounds.forEach(inb=>{
    (inb.clients||[]).forEach(c=>{
      any=true;
      const used=Number(c.used_bytes||0), quota=Number(c.quota_bytes||0);
      const pct=quota>0?Math.min(100,Math.round(used/quota*100)):0;
      const ips=ONLINE[c.email]||[]; const on=ips.length>0;
      h+=`<div class="item"><div class="between">
        <div><span class="dot ${on?"":"off"}"></span><b>${esc(c.email)}</b>
          <span class="badge ${c.enabled?"on":"off"}">${c.enabled?t("enabled"):"off"}</span>
          <span class="pill">${esc(inb.remark||inb.tag)}</span>
          ${c.ip_limit?`<span class="pill">${t("ips")} ${ips.length}/${c.ip_limit}</span>`:(on?`<span class="pill">${t("online")} ${ips.length}</span>`:"")}
          ${c.expiry?`<span class="pill">⏳ ${esc(c.expiry.slice(0,10))}</span>`:""}</div>
        <div class="row">
          <button class="btn ghost sm" onclick="showLinks('${c.id}')">${t("showLinks")}</button>
          <button class="btn ghost sm" onclick="addData('${c.id}')">${t("addqta")}</button>
          <button class="btn ghost sm" onclick='clientModal(${JSON.stringify(c).replace(/'/g,"&#39;")})'>${t("edit")}</button>
          <button class="btn bad sm" onclick="delClient('${c.id}')">${t("del")}</button></div></div>
        <div class="mut" style="margin-top:6px">${t("used")}: ${fmtB(used)} / ${quota>0?fmtB(quota):t("unlimited")}</div>
        ${quota>0?`<div class="bar"><i style="width:${pct}%"></i></div>`:""}</div>`;
    });
  });
  if(!any) h+=`<p class="mut">${t("noItems")}</p>`;
  $("#v-clients").innerHTML=h;
}
async function delClient(id){ if(!confirm(t("confirmDel")))return; await api("clients/"+id,{method:"DELETE"}); toast(t("saved")); await load(); }
async function addData(id){ const g=prompt(t("addqta")+" (GB)","10"); if(g===null)return; await api("client/"+id+"/quota",{method:"POST",body:JSON.stringify({delta_gb:+g})}); toast(t("saved")); await load(); }
function clientModal(c){
  if(!STATE.inbounds.length){ toast(({fa:"اول یک اینباند بساز",en:"Create an inbound first",ar:"أنشئ واردة أولاً",ru:"Сначала создайте входящий"})[LANG]); return; }
  c=c||{email:"",secret:"",quota_bytes:0,expiry:"",ip_limit:0,enabled:true,inbound_id:(STATE.inbounds[0]||{}).id};
  const opts=STATE.inbounds.map(i=>`<option value="${i.id}" ${i.id===c.inbound_id?"selected":""}>${esc(i.remark||i.tag)} (${i.protocol}/${i.network})</option>`).join("");
  openModal(`<h3>${c.id?t("edit"):t("addClient")}</h3>
    <label>Inbound</label><select id="cl_inbound">${opts}</select>
    <label>${t("email")}</label><input id="cl_email" value="${esc(c.email||"")}" placeholder="auto">
    <label>${t("secret")}</label><input id="cl_secret" value="${esc(c.secret||"")}" placeholder="auto">
    <div class="grid g2">
      <div><label>${t("quota")}</label><input id="cl_quota" type="number" step="0.1" value="${gb(c.quota_bytes)}"></div>
      <div><label>${t("ipLimit")}</label><input id="cl_iplimit" type="number" value="${c.ip_limit||0}"></div></div>
    <label>${t("expiry")}</label><input id="cl_expiry" type="date" value="${c.expiry?esc(c.expiry.slice(0,10)):""}">
    <label class="row" style="margin-top:12px"><input type="checkbox" id="cl_enabled" style="width:auto" ${c.enabled?"checked":""}> ${t("enabled")}</label>
    <div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveClient("${c.id||""}")'>${t("save")}</button></div>`);
}
async function saveClient(id){
  const body={ id:id||undefined, inbound_id:+$("#cl_inbound").value, email:$("#cl_email").value,
    secret:$("#cl_secret").value||undefined, quota_bytes:toBytes($("#cl_quota").value),
    ip_limit:+$("#cl_iplimit").value||0, expiry:$("#cl_expiry").value, enabled:$("#cl_enabled").checked };
  const r=await api("clients",{method:"POST",body:JSON.stringify(body)}); closeModal(); toast(r.reload?t("reloaded"):t("saved")); await load();
}
async function showLinks(id){
  const d=await api("client/"+id+"/links");
  const infoUrl=d.sub_url.replace("/sub/","/info/");
  let h=`<h3>${t("links")}</h3>`;
  (d.links||[]).forEach(l=>{ h+=`<div class="code" style="margin-bottom:6px">${esc(l)}</div>
    <div class="row" style="margin-bottom:10px"><button class="btn sm" onclick="copy('${l.replace(/'/g,"\\'")}')">${t("copy")}</button></div>`; });
  h+=`<label>${t("sub")}</label><div class="row"><input value="${esc(d.sub_url)}" readonly><button class="btn sm" onclick="copy('${d.sub_url}')">${t("copy")}</button></div>
    <label>${t("infoPage")}</label><div class="row"><input value="${esc(infoUrl)}" readonly>
      <button class="btn sm" onclick="copy('${infoUrl}')">${t("copy")}</button>
      <a class="btn sm" href="${esc(infoUrl)}" target="_blank">↗</a></div>
    <div style="text-align:center;margin-top:16px"><div class="qr" id="qrbox"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" onclick="closeModal()">${t("back")}</button></div>`;
  openModal(h);
  const first=(d.links||[])[0]||d.sub_url;
  setTimeout(()=>{ const b=$("#qrbox"); if(window.QRCode) new QRCode(b,{text:first,width:190,height:190});
    else b.innerHTML=`<img style="width:190px" src="https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(first)}">`; },60);
}

/* ---------- nodes (multi-location) ---------- */
function renderNodes(){
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("nodes")}</h3>
    <button class="btn sm" onclick="nodeModal()">${t("addNode")}</button></div>
    <p class="mut">${LANG==="fa"?"چند سرور با لوکیشن‌های مختلف را اینجا ثبت کن (نیازمند نصب agent روی هر نود — فاز بعد).":"Register multi-location servers here (each node runs an agent — coming next)."}</p></div>`;
  (STATE.nodes||[]).forEach(n=>{
    h+=`<div class="item"><div class="between"><div><b>${esc(n.name)}</b> <span class="pill">${esc(n.location||"")}</span>
      <span class="badge ${n.status==="online"?"on":"off"}">${esc(n.status||"unknown")}</span></div>
      <div class="row"><button class="btn ghost sm" onclick='nodeModal(${JSON.stringify(n).replace(/'/g,"&#39;")})'>${t("edit")}</button>
      <button class="btn bad sm" onclick="delNode(${n.id})">${t("del")}</button></div></div>
      <div class="mut" style="margin-top:6px">${esc(n.address||"")} · ${esc(n.api_url||"")}</div></div>`;
  });
  if(!(STATE.nodes||[]).length) h+=`<p class="mut">${t("noItems")}</p>`;
  $("#v-nodes").innerHTML=h;
}
function nodeModal(n){
  n=n||{name:"",location:"",address:"",api_url:"",secret:"",enabled:true};
  openModal(`<h3>${n.id?t("edit"):t("addNode")}</h3>
    <label>${t("remark")}</label><input id="nd_name" value="${esc(n.name||"")}">
    <label>${t("location")}</label><input id="nd_loc" value="${esc(n.location||"")}" placeholder="Frankfurt 🇩🇪">
    <label>${t("address")}</label><input id="nd_addr" value="${esc(n.address||"")}">
    <label>${t("apiUrl")}</label><input id="nd_api" value="${esc(n.api_url||"")}" placeholder="https://ip:2099">
    <label>${t("secretK")}</label><input id="nd_secret" value="${esc(n.secret||"")}">
    <div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveNode("${n.id||""}")'>${t("save")}</button></div>`);
}
async function saveNode(id){
  await api("nodes",{method:"POST",body:JSON.stringify({id:id||undefined,name:$("#nd_name").value,location:$("#nd_loc").value,
    address:$("#nd_addr").value,api_url:$("#nd_api").value,secret:$("#nd_secret").value})});
  closeModal(); toast(t("saved")); await load();
}
async function delNode(id){ if(!confirm(t("confirmDel")))return; await api("nodes/"+id,{method:"DELETE"}); toast(t("saved")); await load(); }

/* ---------- settings ---------- */
function renderSettings(){
  const s=STATE.settings||{};
  const botOn = !!s.bot_configured;
  $("#v-settings").innerHTML=`<div class="card"><h3>${t("settings")}</h3>
    <label>${t("serverAddr")}</label><input id="se_addr" value="${esc(s.server_addr||"")}">
    <label>${t("panelPort")}</label><input id="se_port" type="number" value="${esc(s.panel_port||"2099")}">
    <span class="mut">${t("panelPortHint")}</span>
    <label>${t("newPass")}</label><input id="se_pass" type="password" placeholder="••••">
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save">${t("saveSettings")}</button></div></div>

  <div class="card"><div class="between"><h3 style="margin:0">🤖 ${t("tgBot")}</h3>
    <span class="badge ${botOn?"on":"off"}">${botOn?t("running"):t("stopped")}</span></div>
    <p class="mut">${t("tgBotHint")}</p>
    <label>${t("botToken")}</label><input id="se_bot" placeholder="${botOn?"•••••• ("+t("configured")+")":"123456:ABC-DEF…"}">
    <label>${t("botAdmins")}</label><input id="se_admins" value="${esc(s.bot_admins||"")}" placeholder="123456789,987654321">
    <div class="row" style="margin-top:16px"><button class="btn" id="se_botsave">${t("saveSettings")}</button></div></div>

  <div class="card"><h3>🛡 ${t("antiFilter")}</h3>
    <p class="mut">${t("antiFilterHint")}</p></div>`;
  $("#se_save").onclick=async()=>{ await api("settings",{method:"POST",body:JSON.stringify({server_addr:$("#se_addr").value,panel_port:$("#se_port").value,new_password:$("#se_pass").value||undefined})}); toast(t("saved")); load(); };
  $("#se_botsave").onclick=async()=>{ const body={bot_admins:$("#se_admins").value}; if($("#se_bot").value.trim())body.bot_token=$("#se_bot").value.trim(); await api("settings",{method:"POST",body:JSON.stringify(body)}); toast(t("saved")); load(); };
}

/* ---------- logs ---------- */
async function renderLogs(){
  const d=await api("logs").catch(()=>({logs:[]}));
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("logs")}</h3><button class="btn ghost sm" onclick="renderLogs()">↻</button></div>`;
  if(!d.logs||!d.logs.length) h+=`<p class="mut">${t("noItems")}</p>`;
  (d.logs||[]).forEach(l=>{ h+=`<div class="logrow"><span class="pill">${esc(l.type)}</span><span>${esc(l.detail)}</span>
    <span class="mut" style="margin-inline-start:auto">${esc((l.ts||"").replace("T"," ").slice(0,19))}</span>${l.ip?`<span class="mut">${esc(l.ip)}</span>`:""}</div>`; });
  $("#v-logs").innerHTML=h+`</div>`;
}

/* ---------- modal ---------- */
function openModal(html){ $("#modalc").innerHTML=html; $("#modal").hidden=false; }
function closeModal(){ $("#modal").hidden=true; }
$("#modal").onclick=(e)=>{ if(e.target.id==="modal") closeModal(); };

/* ---------- init ---------- */
$("#lg_btn").onclick=doLogin;
$("#lg_pass").addEventListener("keydown",e=>{ if(e.key==="Enter") doLogin(); });
$("#logoutBtn").onclick=doLogout;
$("#themeBtn").onclick=()=>setTheme(THEME==="dark"?"light":"dark");
$("#loginTheme").onclick=()=>setTheme(THEME==="dark"?"light":"dark");
applyChrome();
load();
