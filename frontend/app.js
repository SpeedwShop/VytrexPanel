/* Vytrex Panel 1.0 — SPA logic (EN/FA/AR/RU) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => document.querySelectorAll(s);
let STATE = { settings:{}, inbounds:[], outbounds:[], routing:[], nodes:[], stats:{} };
let ONLINE = {};
let LANG = localStorage.getItem("vx_lang") || "en";
let SETTINGS_TAB = "general";
let THEME = localStorage.getItem("vx_theme") || "dark";
let CUR = "overview";
let monTimer = null;

const RTL = ["fa", "ar"];
const LANGS = [["fa","فارسی"],["en","English"],["ar","العربية"],["ru","Русский"]];

const T = {
  fa:{welcome:"خوش آمدید", username:"نام کاربری", password:"رمز عبور", signin:"ورود", logout:"خروج",
    overview:"داشبورد", inbounds:"اینباند", outbounds:"اوت‌باند", routing:"مسیریابی", clients:"کاربران", nodes:"نودها", settings:"تنظیمات", logs:"لاگ‌ها",
    inboundsN:"اینباند", clientsN:"کاربر", traffic:"کل ترافیک", xray:"Xray", running:"فعال", stopped:"متوقف",
    cpu:"پردازنده", ram:"حافظه", disk:"دیسک", uptime:"آپتایم", online:"آنلاین", offline:"آفلاین", net:"شبکه",
    addInbound:"+ اینباند", addClient:"+ کاربر", addOutbound:"+ اوت‌باند", addNode:"+ نود", addRule:"+ رول",
    edit:"ویرایش", del:"حذف", save:"ذخیره", cancel:"انصراف",
    remark:"نام", protocol:"پروتکل", network:"شبکه", security:"امنیت", port:"پورت", enabled:"فعال",
    path:"مسیر", host:"هاست", serviceName:"نام سرویس gRPC", sni:"SNI", mode:"حالت (xhttp)",
    dest:"مقصد Reality", serverNames:"Server Names", genkeys:"تولید کلید Reality",
    email:"نام کاربر", secret:"UUID/رمز", quota:"حجم", expiry:"انقضا", onHold:"در انتظار (On Hold) — شروع شمارش از اولین اتصال",
    ipLimit:"محدودیت IP (۰=نامحدود)", links:"لینک‌ها", sub:"لینک اشتراک", infoPage:"صفحه‌ی کاربر", qr:"QR",
    copy:"کپی", copied:"کپی شد", saved:"ذخیره شد", reloaded:"Xray ری‌لود شد",
    used:"مصرف", unlimited:"نامحدود", noItems:"موردی نیست", confirmDel:"حذف شود؟",
    serverAddr:"آدرس سرور اصلی", theme:"تم", lang:"زبان", newPass:"رمز جدید (خالی=بدون تغییر)", newUser:"یوزرنیم لاگین (خالی=بدون تغییر)",
    saveSettings:"ذخیره‌ی تنظیمات", reload:"ری‌لود Xray", showLinks:"لینک/QR", back:"بازگشت",
    panelPort:"پورت پنل", panelPath:"پچ مخفی پنل", panelPathHint:"پنل فقط با این مسیر باز می‌شود (e.g. 1234). بعد از تغییر: systemctl restart vytrex-panel",
    tgBot:"ربات تلگرام", tgBotHint:"توکن ربات را از BotFather بگیر و آیدی عددی ادمین‌ها را وارد کن. کاربران با /link و توکن اشتراکشان وارد می‌شوند.",
    botToken:"توکن ربات", botAdmins:"آیدی عددی ادمین‌ها", configured:"تنظیم‌شده", antiFilter:"ضدفیلتر و استتار",
    antiFilterHint:"قابلیت Reality با xtls-rprx-vision قوی‌ترین ترنسپورت فعلی است.",
    location:"لوکیشن", address:"آدرس/IP", apiUrl:"آدرس API", secretK:"کلید امن", addqta:"+حجم", ips:"IPها", reset:"ریست حجم",
    outSettings:"تنظیمات (JSON)", quickAdd:"افزودن سریع",
    dnsServers:"سرورهای DNS اختصاصی (کاما جدا)", subDomain:"دامنه لینک ساب (دلخواه)", subPort:"پورت لینک ساب (دلخواه)",
    basicInfo:"اطلاعات پایه", netConfig:"تنظیمات شبکه", secConfig:"تنظیمات امنیت (TLS/Reality)",
    sourceTag:"تگ مبدأ (inboundTag)", outTag:"اوت‌باند مقصد (outboundTag)", domains:"دامنه‌ها (کاما جدا)", ipsMatch:"آیپی‌ها (کاما جدا)", portsMatch:"پورت‌ها (کاما جدا)" },
  en:{welcome:"Welcome back", username:"Username", password:"Password", signin:"Sign in", logout:"Logout",
    overview:"Overview", inbounds:"Inbounds", outbounds:"Outbounds", routing:"Routing", clients:"Clients", nodes:"Nodes", settings:"Settings", logs:"Logs",
    inboundsN:"Inbounds", clientsN:"Clients", traffic:"Total Traffic", xray:"Xray", running:"Running", stopped:"Stopped",
    cpu:"CPU", ram:"RAM", disk:"Disk", uptime:"Uptime", online:"Online", offline:"Offline", net:"Network",
    addInbound:"+ Inbound", addClient:"+ Client", addOutbound:"+ Outbound", addNode:"+ Node", addRule:"+ Rule",
    edit:"Edit", del:"Delete", save:"Save", cancel:"Cancel",
    remark:"Remark", protocol:"Protocol", network:"Network", security:"Security", port:"Port", enabled:"Enabled",
    path:"Path", host:"Host", serviceName:"gRPC service", sni:"SNI", mode:"Mode (xhttp)",
    dest:"Reality dest", serverNames:"Server Names", genkeys:"Generate Reality keys",
    email:"Client name", secret:"UUID/password", quota:"Quota", expiry:"Expiry", onHold:"On Hold — start counting on first use",
    ipLimit:"IP limit (0=unlimited)", links:"Links", sub:"Subscription URL", infoPage:"User page", qr:"QR",
    copy:"Copy", copied:"Copied", saved:"Saved", reloaded:"Xray reloaded",
    used:"Used", unlimited:"Unlimited", noItems:"No items", confirmDel:"Delete?",
    serverAddr:"Main server address", theme:"Theme", lang:"Language", newPass:"New password (blank=keep)", newUser:"Login user (blank=keep)",
    saveSettings:"Save settings", reload:"Reload Xray", showLinks:"Links/QR", back:"Back",
    panelPort:"Panel port", panelPath:"Secret panel path", panelPathHint:"Panel is only accessible via this path. Requires: systemctl restart vytrex-panel", tgBot:"Telegram bot",
    tgBotHint:"Get a token from BotFather and add admin numeric chat IDs.",
    botToken:"Bot token", botAdmins:"Admin chat IDs", configured:"configured", antiFilter:"Anti-filter & camouflage",
    antiFilterHint:"Reality with xtls-rprx-vision is the strongest transport available today.",
    location:"Location", address:"Address/IP", apiUrl:"API URL", secretK:"Secret", addqta:"+Data", ips:"IPs", reset:"Reset usage",
    outSettings:"Settings (JSON)", quickAdd:"Quick add",
    dnsServers:"Custom DNS servers (comma-separated)", subDomain:"Sub domain (optional)", subPort:"Sub port (optional)",
    basicInfo:"Basic Info", netConfig:"Network Config", secConfig:"Security (TLS/Reality)",
    sourceTag:"Source Tag (inboundTag)", outTag:"Target Outbound", domains:"Domains (comma-sep)", ipsMatch:"IPs (comma-sep)", portsMatch:"Ports (comma-sep)" }
};
const t = (k) => (T[LANG] && T[LANG][k]) || (T["en"][k]) || k;

const NETWORKS = ["tcp","ws","grpc","httpupgrade","xhttp"];
const PROTOCOLS = ["vless","vmess","trojan","shadowsocks"];
const SECURITIES = ["none","tls","reality"];
const TABS = ["overview","inbounds","outbounds","routing","clients","nodes","settings","logs"];

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
  document.querySelectorAll("[data-i18n]").forEach(e=>e.textContent=t(e.dataset.i18n));
  document.querySelectorAll("[data-i18n-ph]").forEach(e=>e.placeholder=t(e.dataset.i18nPh));
}
function setLang(l){ LANG=l; localStorage.setItem("vx_lang",l); applyChrome(); if(!$("#app").hidden)renderTabs(),renderCurrent(); }
function setTheme(x){ THEME=x; localStorage.setItem("vx_theme",x); applyChrome(); }

/* ---------- auth ---------- */
function showLogin(){ stopMon(); $("#app").hidden=true; $("#login").hidden=false; }
async function doLogin(){
  const body={username:$("#lg_user").value, password:$("#lg_pass").value};
  const otpEl=$("#lg_otp"); if(otpEl && otpEl.value.trim()) body.otp=otpEl.value.trim();
  const r = await fetch("/api/login",{method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify(body)});
  if(r.ok){ $("#login").hidden=true; $("#app").hidden=false; await load(); return; }
  let data={}; try{ data=await r.json(); }catch(e){}
  if(data.twofa){
    // reveal the 2FA code field and prompt for it
    if(!$("#lg_otp")){
      const p=$("#lg_pass").parentElement || document.body;
      const wrap=document.createElement("div");
      wrap.innerHTML=`<label>${({fa:"کد ۲مرحله‌ای",en:"2FA code"})[LANG]||"2FA code"}</label>`+
        `<input id="lg_otp" inputmode="numeric" autocomplete="one-time-code" placeholder="123456">`;
      $("#lg_pass").insertAdjacentElement("afterend", wrap);
      $("#lg_otp").addEventListener("keydown",e=>{ if(e.key==="Enter") doLogin(); });
    }
    $("#lg_otp").focus();
    $("#lg_err").textContent = ({fa:"کد تأیید دومرحله‌ای را وارد کنید",en:"Enter your 2FA code"})[LANG]||"Enter your 2FA code";
    return;
  }
  $("#lg_err").textContent = ({fa:"نام کاربری یا رمز اشتباه است",en:"Invalid credentials"})[LANG]||"Error";
}
async function doLogout(){ await api("logout",{method:"POST"}).catch(()=>{}); showLogin(); }

/* ---------- load ---------- */
async function load(){
  try{
    STATE = await api("state");
    $("#verlbl").textContent = "v"+(STATE.version||"");
    if($("#verlbl2")) $("#verlbl2").textContent = "v"+(STATE.version||"");
    $("#app").hidden=false; $("#login").hidden=true;
    render();
  }catch(e){}
}
/* ── v1.0 additional i18n keys (nav groups + settings sections) ── */
Object.assign(T.en, {
  network:"Network", setGeneral:"General", setAuth:"Authentication", setCerts:"Certificates",
  setDateTime:"Date & Time", setNotify:"Notifications", setExternal:"External Traffic",
  setLdap:"LDAP", setTelegram:"Telegram Bot", setBackup:"Backup & Restore",
});
if(T.fa) Object.assign(T.fa, {
  network:"شبکه", setGeneral:"عمومی", setAuth:"احراز هویت", setCerts:"گواهی‌ها",
  setDateTime:"تاریخ و زمان", setNotify:"اعلان‌ها", setExternal:"ترافیک خارجی",
  setLdap:"LDAP", setTelegram:"ربات تلگرام", setBackup:"پشتیبان‌گیری",
});
if(T.ar) Object.assign(T.ar, {
  network:"الشبكة", setGeneral:"عام", setAuth:"المصادقة", setCerts:"الشهادات",
  setDateTime:"التاريخ والوقت", setNotify:"الإشعارات", setExternal:"حركة خارجية",
  setLdap:"LDAP", setTelegram:"بوت تليجرام", setBackup:"النسخ الاحتياطي",
});
if(T.ru) Object.assign(T.ru, {
  network:"Сеть", setGeneral:"Общие", setAuth:"Аутентификация", setCerts:"Сертификаты",
  setDateTime:"Дата и время", setNotify:"Уведомления", setExternal:"Внешний трафик",
  setLdap:"LDAP", setTelegram:"Telegram-бот", setBackup:"Резервная копия",
});

/* ── side navigation model: single items + collapsible groups with animated dropdowns ── */
const NAV = [
  { id:"overview", ic:"▦" },
  { id:"inbounds", ic:"◱" },
  { id:"clients",  ic:"☰" },
  { group:"network", ic:"⇄", items:[ {tab:"outbounds"}, {tab:"routing"}, {tab:"nodes"} ] },
  { group:"settings", ic:"⚙", tab:"settings", items:[
      {sub:"general",  k:"setGeneral"}, {sub:"auth", k:"setAuth"}, {sub:"certs", k:"setCerts"},
      {sub:"datetime", k:"setDateTime"}, {sub:"notify", k:"setNotify"},
      {sub:"external", k:"setExternal"}, {sub:"ldap", k:"setLdap"},
      {sub:"telegram", k:"setTelegram"}, {sub:"backup", k:"setBackup"} ] },
  { id:"logs", ic:"❑" },
];

function navItemHtml(id, ic, label, active){
  return `<button class="nav-item ${active?"active":""}" data-tab="${id}"><span class="ic">${ic}</span><span class="lbl">${label}</span></button>`;
}

function renderTabs(){
  let h = "";
  NAV.forEach(n=>{
    if(n.id){
      h += navItemHtml(n.id, n.ic, t(n.id), CUR===n.id);
    } else {
      // a group with an animated dropdown submenu
      const childActive = (n.tab && CUR===n.tab) || (n.items||[]).some(it=>it.tab && CUR===it.tab);
      const subs = (n.items||[]).map(it=>{
        if(it.tab){
          return navItemHtml(it.tab, "•", t(it.tab), CUR===it.tab);
        }
        const on = CUR==="settings" && SETTINGS_TAB===it.sub;
        return `<button class="nav-item ${on?"active":""}" data-settab="${it.sub}"><span class="ic">•</span><span class="lbl">${t(it.k)}</span></button>`;
      }).join("");
      h += `<div class="nav-group ${childActive?"open":""}" data-group="${n.group}">
        <button class="nav-item" data-toggle="${n.group}"><span class="ic">${n.ic}</span><span class="lbl">${t(n.group)}</span><span class="caret">▶</span></button>
        <div class="nav-sub"><div class="nav-sub-inner">${subs}</div></div>
      </div>`;
    }
  });
  $("#tabs").innerHTML = h;

  // top-level items and network sub-items → switch view
  $$(".nav-item[data-tab]", $("#tabs")).forEach(b=>b.onclick=()=>{ closeSidebar(); switchTab(b.dataset.tab); });
  // group header → toggle the animated dropdown
  $$(".nav-item[data-toggle]", $("#tabs")).forEach(b=>b.onclick=()=>b.parentElement.classList.toggle("open"));
  // settings sub-items → open settings on that section
  $$(".nav-item[data-settab]", $("#tabs")).forEach(b=>b.onclick=()=>{ closeSidebar(); SETTINGS_TAB=b.dataset.settab; switchTab("settings"); });
}

function openSidebar(){ $("#sidebar").classList.add("open"); $("#sideScrim").classList.add("show"); }
function closeSidebar(){ $("#sidebar").classList.remove("open"); $("#sideScrim").classList.remove("show"); }

function switchTab(id){ stopMon(); CUR=id; document.querySelectorAll(".view").forEach(v=>v.hidden=true); $("#v-"+id).hidden=false; renderTabs(); renderCurrent(); window.scrollTo({top:0}); }
function render(){ applyChrome(); renderTabs(); renderCurrent(); }
function renderCurrent(){ ({overview:renderOverview,inbounds:renderInbounds,outbounds:renderOutbounds,routing:renderRouting,clients:renderClients,nodes:renderNodes,settings:renderSettings,logs:renderLogs}[CUR])(); }

/* ---------- drawer logic ---------- */
function drawer(title, body, open=false, id="") {
  return `<div class="drawer ${open?"open":""}" ${id?`id="${id}"`:""}>
    <div class="dhead" onclick="this.parentElement.classList.toggle('open')"><span>${title}</span> <span class="arrow">&#9654;</span></div>
    <div class="dbody"><div class="dinner">${body}</div></div></div>`;
}

/* ---------- overview + system monitor ---------- */
function stopMon(){ if(monTimer){ clearInterval(monTimer); monTimer=null; } }
function ringColor(pct){ return pct>85?"var(--bad)":pct>65?"var(--warn)":"var(--ok)"; }
function ring(pct,label,sub){
  const c = ringColor(pct);
  return `<div class="gauge"><div class="ring" style="--p:${pct};--c:${c}"><div class="in">${pct}%</div></div>
    <div class="l">${label}</div><div class="sub">${sub||""}</div></div>`;
}
function renderOverview(){
  const s=STATE.stats||{};
  $("#v-overview").innerHTML = `
    <div class="grid g4">
      <div class="stat"><div class="v">${s.inbounds||0}</div><div class="l">${t("inboundsN")}</div></div>
      <div class="stat"><div class="v">${s.clients||0}</div><div class="l">${t("clientsN")}</div></div>
      <div class="stat"><div class="v">${fmtB(s.total_traffic||0)}</div><div class="l">${t("traffic")}</div></div>
      <div class="stat"><div class="v" style="color:${s.xray_running?"var(--ok)":"var(--bad)"}">${s.xray_running?"&#9679;":"&#9675;"}</div><div class="l">${t("xray")}: ${s.xray_running?t("running"):t("stopped")}</div></div>
    </div>
    <div class="card"><div class="between"><h3 style="margin:0">${t("cpu")} / ${t("ram")} / ${t("disk")}</h3>
      <button class="btn sm" id="reloadBtn">${t("reload")}</button></div>
      <div class="monitor" id="monitor"><p class="mut">…</p></div></div>`;
  $("#reloadBtn").onclick=async()=>{ const r=await api("reload",{method:"POST"}); toast(r.ok?t("reloaded"):("error: "+r.error)); };
  pollMon(); monTimer=setInterval(pollMon,3000);
}
async function pollMon(){
  let m; try{ m=await api("system"); }catch(e){ return; }
  const box=$("#monitor"); if(!box) return;
  box.innerHTML = ring(Math.round(m.cpu||0), t("cpu"), (m.cores||1)+" cores · load "+(m.load?m.load[0].toFixed(2):"-"))
    + ring(Math.round(m.mem?.percent||0), t("ram"), fmtB(m.mem?.used)+" / "+fmtB(m.mem?.total))
    + ring(Math.round(m.disk?.percent||0), t("disk"), fmtB(m.disk?.used)+" / "+fmtB(m.disk?.total))
    + `<div class="gauge"><div class="ring" style="--p:0;--c:var(--border)"><div class="in">&#8593;&#8595;</div></div>
        <div class="l">${t("net")}</div><div class="sub">&#8595;${fmtB(m.net?.rx)}/s &#8593;${fmtB(m.net?.tx)}/s<br>${t("uptime")}: ${fmtUptime(m.uptime)}</div></div>`;
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
  inb = inb || {protocol:"vless",network:"tcp",security:"none",port:443,enabled:true,stream:{},settings:{}};
  const st=inb.stream||{}; const sets=inb.settings||{};
  const sel=(id,opts,val)=>`<select id="${id}">${opts.map(o=>`<option ${o===val?"selected":""}>${o}</option>`).join("")}</select>`;

  let html = `<h3>${inb.id?t("edit"):t("addInbound")}</h3>
    <label>${t("remark")}</label><input id="in_remark" value="${esc(inb.remark||"")}">

    ${drawer(t("basicInfo"), `
      <div class="grid g2" style="margin-bottom:12px">
        <div><label>${t("protocol")}</label>${sel("in_protocol",PROTOCOLS,inb.protocol)}</div>
        <div><label>${t("port")}</label><input id="in_port" type="number" value="${inb.port||443}"></div>
        <div><label>Inbound listen (IP)</label><input id="in_listen" value="${esc(inb.listen||"0.0.0.0")}" placeholder="0.0.0.0"></div>
      </div>
      <div id="ss_wrap" class="subfield" style="margin-bottom:12px" hidden>
        <label>Shadowsocks Method</label><input id="in_ss_method" value="${esc(sets.method||"aes-256-gcm")}" placeholder="aes-256-gcm / 2022-blake3-aes-128-gcm">
      </div>
    `, true)}

    ${drawer(t("netConfig"), `
      <div class="grid g2" style="margin-bottom:12px">
        <div><label>${t("network")}</label>${sel("in_network",NETWORKS,inb.network)}</div>
      </div>
      <div id="net_fields" class="subfield grid g2">
        <div><label>${t("path")}</label><input id="in_path" value="${esc(st.path||"/")}"></div>
        <div><label>${t("host")}</label><input id="in_host" value="${esc(st.host||"")}"></div>
        <div><label>${t("serviceName")}</label><input id="in_service" value="${esc(st.serviceName||"vytrex")}"></div>
        <div><label>${t("mode")}</label><input id="in_mode" value="${esc(st.mode||"auto")}" placeholder="auto/packet"></div>
      </div>
    `, inb.network!=="tcp")}

    ${drawer(t("secConfig"), `
      <div style="margin-bottom:12px"><label>${t("security")}</label>${sel("in_security",SECURITIES,inb.security)}</div>
      <div id="sec_fields" class="subfield" hidden>
        <div class="grid g2">
          <div><label>${t("sni")}</label><input id="in_sni" value="${esc(st.sni||"")}" placeholder="domain.com"></div>
        </div>
        <div id="sec_reality" class="subfield" hidden>
          <label>${t("serverNames")}</label><input id="in_snames" value="${esc((st.serverNames||["www.microsoft.com"]).join(","))}">
          <label>${t("dest")}</label><input id="in_dest" value="${esc(st.dest||"www.microsoft.com:443")}">
          <input id="in_pk" type="hidden" value="${esc(st.privateKey||"")}"><input id="in_pub" type="hidden" value="${esc(st.publicKey||"")}">
          <input id="in_sid" type="hidden" value="${esc((st.shortIds||[]).join(","))}">
          <div class="row" style="margin-top:10px">
            <button class="btn ghost sm" onclick="genReality()">${t("genkeys")}</button>
            <span class="mut" id="in_keyinfo">${st.publicKey?("pbk="+st.publicKey.slice(0,10)+"…"):""}</span>
          </div>
        </div>
      </div>
    `, inb.security!=="none")}

    <label class="row" style="margin-top:16px;cursor:pointer"><input type="checkbox" id="in_enabled" style="width:auto" ${inb.enabled?"checked":""}> ${t("enabled")}</label>
    <div class="row" style="justify-content:flex-end;margin-top:20px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveInbound("${inb.id||""}")'>${t("save")}</button>
    </div>`;
  openModal(html);

  const syncUi = () => {
    const proto = $("#in_protocol").value, net = $("#in_network").value, sec = $("#in_security").value;
    $("#ss_wrap").hidden = (proto !== "shadowsocks");
    $("#net_fields").hidden = (net === "tcp");
    $("#sec_fields").hidden = (sec === "none");
    $("#sec_reality").hidden = (sec !== "reality");
  };
  $("#in_protocol").onchange = syncUi;
  $("#in_network").onchange = syncUi;
  $("#in_security").onchange = syncUi;
  syncUi();
}
async function genReality(){ const k=await api("genkeys"); $("#in_pk").value=k.privateKey;$("#in_pub").value=k.publicKey;$("#in_sid").value=k.shortId;
  $("#in_keyinfo").textContent=k.publicKey?("pbk="+k.publicKey.slice(0,12)+"…"):"xray not installed"; }
async function saveInbound(id){
  const stream={ path:$("#in_path").value, host:$("#in_host").value, serviceName:$("#in_service").value,
    sni:$("#in_sni").value, mode:$("#in_mode").value,
    serverNames:$("#in_snames").value.split(",").map(s=>s.trim()).filter(Boolean), dest:$("#in_dest").value,
    privateKey:$("#in_pk").value, publicKey:$("#in_pub").value,
    shortIds:$("#in_sid").value.split(",").map(s=>s.trim()).filter(Boolean) };
  const settings={ method:$("#in_ss_method").value.trim() };
  const body={ id:id||undefined, remark:$("#in_remark").value, protocol:$("#in_protocol").value,
    network:$("#in_network").value, security:$("#in_security").value, port:+$("#in_port").value,
    listen:($("#in_listen")&&$("#in_listen").value)||"0.0.0.0",
    enabled:$("#in_enabled").checked, stream, settings };
  const r=await api("inbounds",{method:"POST",body:JSON.stringify(body)});
  if(!r.ok){ toast("error: "+r.error); } else { closeModal(); toast(r.reload?t("reloaded"):t("saved")); await load(); }
}

/* ---------- outbounds ---------- */
function renderOutbounds(){
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("outbounds")}</h3>
    <button class="btn sm" onclick="outboundModal()">${t("addOutbound")}</button></div>
    <p class="mut">direct + blocked are built-in.</p></div>`;
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
    <label>${t("protocol")}</label><input id="ob_proto" value="${esc(o.protocol||"freedom")}" placeholder="freedom / wireguard">
    <label>${t("outSettings")}</label><textarea id="ob_settings" style="min-height:120px">${esc(settings)}</textarea>
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

/* ---------- routing ---------- */
function renderRouting(){
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("routing")}</h3>
    <button class="btn sm" onclick="routingModal()">${t("addRule")}</button></div></div>`;
  (STATE.routing||[]).forEach(r=>{
    h+=`<div class="item"><div class="between">
      <div><b>${esc(r.remark||r.outbound_tag)}</b> <span class="badge ${r.enabled?"on":"off"}">${r.enabled?t("enabled"):"off"}</span></div>
      <div class="row"><button class="btn ghost sm" onclick='routingModal(${JSON.stringify(r).replace(/'/g,"&#39;")})'>${t("edit")}</button>
      <button class="btn bad sm" onclick="delRouting(${r.id})">${t("del")}</button></div></div>
      <div class="row" style="margin-top:8px">
        <span class="pill">IN: ${esc(r.source_tag||"*")}</span> <span class="pill" style="border-color:var(--accent)">OUT: ${esc(r.outbound_tag)}</span>
        ${r.domains?`<span class="pill">DOM: ${esc(r.domains.substring(0,20))}${r.domains.length>20?"…":""}</span>`:""}
        ${r.ips?`<span class="pill">IP: ${esc(r.ips)}</span>`:""}
      </div></div>`;
  });
  if(!(STATE.routing||[]).length) h+=`<p class="mut">${t("noItems")}</p>`;
  $("#v-routing").innerHTML=h;
}
function routingModal(r){
  r=r||{remark:"",source_tag:"",outbound_tag:"blocked",domains:"",ips:"",ports:"",enabled:true};
  openModal(`<h3>${r.id?t("edit"):t("addRule")}</h3>
    <label>${t("remark")}</label><input id="rr_remark" value="${esc(r.remark||"")}">
    <div class="grid g2">
      <div><label>${t("sourceTag")}</label><input id="rr_in" value="${esc(r.source_tag||"")}"></div>
      <div><label>${t("outTag")}</label><input id="rr_out" value="${esc(r.outbound_tag||"")}" placeholder="blocked/direct/warp"></div>
    </div>
    <label>${t("domains")}</label><textarea id="rr_dom" style="min-height:60px" placeholder="geosite:category-ads-all">${esc(r.domains||"")}</textarea>
    <label>${t("ipsMatch")}</label><textarea id="rr_ip" style="min-height:40px">${esc(r.ips||"")}</textarea>
    <label>${t("portsMatch")}</label><input id="rr_port" value="${esc(r.ports||"")}">
    <label class="row" style="margin-top:12px;cursor:pointer"><input type="checkbox" id="rr_enabled" style="width:auto" ${r.enabled?"checked":""}> ${t("enabled")}</label>
    <div class="row" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveRouting("${r.id||""}")'>${t("save")}</button></div>`);
}
async function saveRouting(id){
  const body={ id:id||undefined, remark:$("#rr_remark").value, source_tag:$("#rr_in").value, outbound_tag:$("#rr_out").value,
    domains:$("#rr_dom").value, ips:$("#rr_ip").value, ports:$("#rr_port").value, enabled:$("#rr_enabled").checked };
  const r=await api("routing",{method:"POST",body:JSON.stringify(body)});
  if(!r.ok){ toast("error"); } else { closeModal(); toast(r.reload?t("reloaded"):t("saved")); await load(); }
}
async function delRouting(id){ if(!confirm(t("confirmDel")))return; await api("routing/"+id,{method:"DELETE"}); toast(t("saved")); await load(); }

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
      const bColor=pct>90?"bad":pct>75?"warn":"ok";
      const ips=ONLINE[c.email]||[]; const on=ips.length>0;
      const hold=!!c.on_hold;
      h+=`<div class="item"><div class="between">
        <div class="row"><span class="dot ${on?"":"off"}"></span><b style="font-size:14px">${esc(c.email)}</b>
          <span class="badge ${c.enabled?"on":"off"}">${c.enabled?t("enabled"):"off"}</span>
          <span class="pill">${esc(inb.remark||inb.tag)}</span>
          ${hold?`<span class="pill" style="color:var(--warn);border-color:var(--warn)">ON HOLD</span>`:""}
          ${c.ip_limit?`<span class="pill">${t("ips")} ${ips.length}/${c.ip_limit}</span>`:(on?`<span class="pill">${t("online")} ${ips.length}</span>`:"")}
          ${c.expiry?`<span class="pill">&#8987; ${esc(c.expiry.slice(0,10))}</span>`:""}</div>
        <div class="row">
          <button class="btn ghost sm" onclick="showLinks('${c.id}')">${t("showLinks")}</button>
          <button class="btn ghost sm" onclick="addData('${c.id}')">${t("addqta")}</button>
          <button class="btn ghost sm" onclick='clientModal(${JSON.stringify(c).replace(/'/g,"&#39;")})'>${t("edit")}</button>
          <button class="btn bad sm" onclick="delClient('${c.id}')">${t("del")}</button></div></div>
        <div class="mut" style="margin-top:8px">${t("used")}: ${fmtB(used)} / ${quota>0?fmtB(quota):t("unlimited")}</div>
        ${quota>0?`<div class="bar"><i class="${bColor}" style="width:${pct}%"></i></div>`:""}</div>`;
    });
  });
  if(!any) h+=`<p class="mut">${t("noItems")}</p>`;
  $("#v-clients").innerHTML=h;
}
async function delClient(id){ if(!confirm(t("confirmDel")))return; await api("clients/"+id,{method:"DELETE"}); toast(t("saved")); await load(); }
async function addData(id){ const g=prompt(t("addqta")+" (GB)","10"); if(g===null)return; await api("client/"+id+"/quota",{method:"POST",body:JSON.stringify({delta_gb:+g})}); toast(t("saved")); await load(); }
function genUuid(){ return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{const r=Math.random()*16|0,v=c=='x'?r:(r&0x3|0x8);return v.toString(16)}); }
function genUsername(){ const adj=["swift","nova","cyan","apex","neon","zeta","sky"],noun=["falcon","lynx","fox","wolf","bear","owl","ray"]; return adj[Math.floor(Math.random()*adj.length)]+"-"+noun[Math.floor(Math.random()*noun.length)]+"-"+Math.floor(Math.random()*999); }
function clientModal(c){
  if(!STATE.inbounds.length){ toast("Create an inbound first"); return; }
  c=c||{email:"",secret:"",quota_bytes:0,expiry:"",ip_limit:0,enabled:true,on_hold:0,total_days:0,inbound_id:(STATE.inbounds[0]||{}).id};
  const opts=STATE.inbounds.map(i=>`<option value="${i.id}" ${i.id===c.inbound_id?"selected":""}>${esc(i.remark||i.tag)} (${i.protocol}/${i.network})</option>`).join("");
  openModal(`<h3>${c.id?t("edit"):t("addClient")}</h3>
    <label>Inbound</label><select id="cl_inbound">${opts}</select>

    <label>${t("email")}</label>
    <div class="row" style="flex-wrap:nowrap"><input id="cl_email" value="${esc(c.email||"")}" placeholder="auto"><button class="spin-btn" onclick="$('#cl_email').value=genUsername();this.classList.add('spin');setTimeout(()=>this.classList.remove('spin'),500)">&#127922;</button></div>

    <label>${t("secret")}</label>
    <div class="row" style="flex-wrap:nowrap"><input id="cl_secret" value="${esc(c.secret||"")}" placeholder="auto"><button class="spin-btn" onclick="$('#cl_secret').value=genUuid();this.classList.add('spin');setTimeout(()=>this.classList.remove('spin'),500)">&#127922;</button></div>

    <div class="grid g2" style="margin-top:6px">
      <div>
        <div class="between"><label>${t("quota")}</label><div class="row" style="gap:4px"><span class="preset" onclick="$('#cl_quota').value=0">&#8734;</span><span class="preset" onclick="$('#cl_quota').value=50">50G</span></div></div>
        <input id="cl_quota" type="number" step="0.1" value="${gb(c.quota_bytes)}">
      </div>
      <div>
        <label>${t("ipLimit")}</label><input id="cl_iplimit" type="number" value="${c.ip_limit||0}">
      </div>
    </div>

    <div class="drawer" style="margin-top:14px;border:none;background:var(--panel2)">
      <div class="dhead" onclick="this.parentElement.classList.toggle('open')"><span>&#9201; Expiry / On Hold</span> <span class="arrow">&#9654;</span></div>
      <div class="dbody"><div class="dinner">
        <label class="row" style="cursor:pointer;margin:6px 0 10px"><input type="checkbox" id="cl_on_hold" style="width:auto" ${c.on_hold?"checked":""}> ${t("onHold")}</label>
        <div class="grid g2" id="cl_exp_wrap">
          <div id="w_days" ${c.on_hold?"":"hidden"}><label>Days (duration)</label><input id="cl_days" type="number" value="${c.total_days||0}"></div>
          <div id="w_date" ${c.on_hold?"hidden":""}>
            <div class="between"><label>${t("expiry")}</label><div class="row" style="gap:4px"><span class="preset" onclick="$('#cl_expiry').value=''">&#8734;</span><span class="preset" onclick="const d=new Date();d.setMonth(d.getMonth()+1);$('#cl_expiry').value=d.toISOString().slice(0,10)">1M</span></div></div>
            <input id="cl_expiry" type="date" value="${c.expiry?esc(c.expiry.slice(0,10)):""}">
          </div>
        </div>
      </div></div>
    </div>

    <div class="row between" style="margin-top:16px">
      <label class="row" style="cursor:pointer;margin:0"><input type="checkbox" id="cl_enabled" style="width:auto" ${c.enabled?"checked":""}> ${t("enabled")}</label>
      ${c.id?`<button class="btn ghost sm" onclick="resetUsage('${c.id}')">${t("reset")}</button>`:""}
    </div>
    <div class="row" style="justify-content:flex-end;margin-top:20px">
      <button class="btn ghost" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn" onclick='saveClient("${c.id||""}")'>${t("save")}</button>
    </div>`);

  $("#cl_on_hold").onchange = (e) => {
    $("#w_days").hidden = !e.target.checked;
    $("#w_date").hidden = e.target.checked;
  };
}
async function saveClient(id){
  const body={ id:id||undefined, inbound_id:+$("#cl_inbound").value, email:$("#cl_email").value,
    secret:$("#cl_secret").value||undefined, quota_bytes:toBytes($("#cl_quota").value),
    ip_limit:+$("#cl_iplimit").value||0, expiry:$("#cl_expiry").value, enabled:$("#cl_enabled").checked,
    on_hold:$("#cl_on_hold").checked, total_days:+$("#cl_days").value||0 };
  const r=await api("clients",{method:"POST",body:JSON.stringify(body)}); closeModal(); toast(r.reload?t("reloaded"):t("saved")); await load();
}
async function resetUsage(id){
  if(!confirm("Reset traffic to 0?")) return;
  await api("client/"+id+"/reset",{method:"POST"}); closeModal(); toast(t("saved")); await load();
}
async function showLinks(id){
  const d=await api("client/"+id+"/links");
  const infoUrl=d.sub_url.replace("/sub/","/info/");
  let h=`<h3>${t("links")}</h3>`;
  (d.links||[]).forEach(l=>{ h+=`<div class="code" style="margin-bottom:6px">${esc(l)}</div>
    <div class="row" style="margin-bottom:12px"><button class="btn sm block" style="margin:0" onclick="copy('${l.replace(/'/g,"\'")}')">${t("copy")}</button></div>`; });
  h+=`<label>${t("sub")}</label><div class="row" style="flex-wrap:nowrap"><input value="${esc(d.sub_url)}" readonly><button class="btn sm" onclick="copy('${d.sub_url}')">${t("copy")}</button></div>
    <label>${t("infoPage")}</label><div class="row" style="flex-wrap:nowrap"><input value="${esc(infoUrl)}" readonly>
      <button class="btn sm" onclick="copy('${infoUrl}')">${t("copy")}</button>
      <a class="btn sm" href="${esc(infoUrl)}" target="_blank" style="text-decoration:none">&#8599;</a></div>
    <div style="text-align:center;margin-top:16px"><div class="qr" id="qrbox"></div></div>
    <div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" onclick="closeModal()">${t("back")}</button></div>`;
  openModal(h);
  const first=(d.links||[])[0]||d.sub_url;
  setTimeout(()=>{ const b=$("#qrbox"); if(window.QRCode) new QRCode(b,{text:first,width:180,height:180});
    else b.innerHTML=`<img style="width:180px" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(first)}">`; },60);
}

/* ---------- nodes ---------- */
function renderNodes(){
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("nodes")}</h3>
    <button class="btn sm" onclick="nodeModal()">${t("addNode")}</button></div>
    <p class="mut">Register multi-location servers here (each node runs an agent — coming next).</p></div>`;
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
    <label>${t("location")}</label><input id="nd_loc" value="${esc(n.location||"")}" placeholder="Frankfurt">
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
  const twofaOn = s.twofa_enabled==="1";
  const chk=(id,on,lbl)=>`<label class="row" style="margin-top:12px;cursor:pointer;gap:8px"><input type="checkbox" id="${id}" style="width:auto" ${on?"checked":""}> ${lbl}</label>`;
  const dh=(icon,title)=>`${icon} ${title}`;   // drawer() adds its own arrow

  const general = `
    <div class="grid g2">
      <div><label>${t("serverAddr")}</label><input id="se_addr" value="${esc(s.server_addr||"")}"></div>
      <div><label>${t("panelPort")}</label><input id="se_port" type="number" value="${esc(s.panel_port||"2099")}"></div>
    </div>
    <label>${t("panelPath")}</label><input id="se_path" value="${esc(s.panel_path||"")}">
    <span class="mut" style="display:block;margin:4px 0 12px">${t("panelPathHint")}</span>
    <div class="grid g2">
      <div><label>Listen IP</label><input id="se_lip" value="${esc(s.listen_ip||"")}" placeholder="blank = all IPs"></div>
      <div><label>Listen Domain</label><input id="se_ldom" value="${esc(s.listen_domain||"")}" placeholder="blank = all domains"></div>
      <div><label>Session Duration (min)</label><input id="se_sess" type="number" value="${esc(s.session_duration||"360")}"></div>
      <div><label>Pagination Size</label><input id="se_pag" type="number" value="${esc(s.pagination_size||"25")}"></div>
    </div>
    <label>Trusted proxy CIDRs</label><input id="se_cidr" value="${esc(s.trusted_cidrs||"127.0.0.1/32,::1/128")}">
    <label>Panel Traffic Outbound</label><input id="se_pout" value="${esc(s.panel_outbound||"")}" placeholder="Direct connection (leave empty)">
    ${chk("se_rstdis", s.restart_after_disable==="1", "Restart Xray after a client is auto-disabled")}
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    <label>${t("dnsServers")}</label><input id="se_dns" value="${esc(s.dns_servers||"")}" placeholder="1.1.1.1, 8.8.8.8">
    <div class="grid g2" style="margin-top:8px">
      <div><label>${t("subDomain")}</label><input id="se_sdom" value="${esc(s.sub_domain||"")}" placeholder="sub.example.com"></div>
      <div><label>${t("subPort")}</label><input id="se_sport" type="number" value="${esc(s.sub_port||"")}" placeholder="443"></div>
    </div>
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save_general">${t("saveSettings")}</button></div>`;

  const auth = `
    <h4 style="margin:2px 0 8px;font-size:13px">&#128100; Admin credentials</h4>
    <span class="mut" style="display:block;margin-bottom:8px">Current user: <b>${esc(s.admin_user||"admin")}</b> — change it here (applies instantly, no SSH needed).</span>
    <div class="grid g2">
      <div><label>${t("newUser")}</label><input id="se_user" placeholder="${esc(s.admin_user||"admin")}"></div>
      <div><label>${t("newPass")}</label><input id="se_pass" type="password" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"></div>
    </div>
    <div class="row" style="margin-top:12px"><button class="btn" id="se_save_admin">${t("saveSettings")}</button></div>
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    <h4 style="margin:2px 0 8px;font-size:13px">&#128272; Two-factor authentication (2FA)
      <span class="badge ${twofaOn?"on":"off"}" style="margin-inline-start:6px">${twofaOn?"ON":"OFF"}</span></h4>
    <span class="mut" style="display:block;margin-bottom:8px">Adds a TOTP code (Google Authenticator / any authenticator app) on top of your password.</span>
    <div id="twofa_area">
      ${twofaOn
        ? `<button class="btn bad sm" id="tf_disable">Disable 2FA</button>`
        : `<button class="btn sm" id="tf_setup">Enable 2FA</button>`}
    </div>
    <hr style="border:none;border-top:1px solid var(--border);margin:16px 0">
    <h4 style="margin:2px 0 8px;font-size:13px">&#128273; API Token</h4>
    <span class="mut" style="display:block;margin-bottom:8px">Use header <code>X-API-Token</code> for automation. Keep it secret.</span>
    <input id="se_apitok" value="${esc(s.api_token||"")}" readonly placeholder="no token yet" style="font-family:ui-monospace,monospace;font-size:12px">
    <div class="row" style="margin-top:12px">
      <button class="btn sm" id="tk_gen">${s.api_token?"Regenerate":"Generate"}</button>
      ${s.api_token?`<button class="btn ghost sm" id="tk_copy">Copy</button><button class="btn bad sm" id="tk_revoke">Revoke</button>`:""}
    </div>`;

  const certs = `
    <span class="mut" style="display:block;margin-bottom:10px">Paths to the SSL certificate used by the panel &amp; TLS inbounds. Applied to Xray live.</span>
    <label>Public Key Path (fullchain.pem)</label>
    <input id="se_cert" value="${esc(s.cert_file||"")}" placeholder="/root/cert/example.com/fullchain.pem">
    <label>Private Key Path (privkey.pem)</label>
    <input id="se_key" value="${esc(s.key_file||"")}" placeholder="/root/cert/example.com/privkey.pem">
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save_certs">${t("saveSettings")}</button></div>
    <span class="mut" style="display:block;margin-top:8px">Changing the panel certificate needs: <code>systemctl restart vytrex-panel</code></span>`;

  const datetime = `
    <label>Time Zone</label>
    <input id="se_tz" value="${esc(s.timezone||"Local")}" placeholder="Local / Asia/Tehran / UTC">
    <label>Calendar Type</label>
    <select id="se_cal">
      <option value="gregorian" ${((s.calendar||"gregorian")==="gregorian")?"selected":""}>Gregorian (Standard)</option>
      <option value="jalali" ${(s.calendar==="jalali")?"selected":""}>Jalali / Shamsi (شمسی)</option>
    </select>
    <span class="mut" style="display:block;margin-top:6px">Jalali shows Shamsi dates on user pages.</span>
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save_dt">${t("saveSettings")}</button></div>`;

  const notify = `
    <label>Expiration Date Notification threshold (days)</label>
    <input id="se_nexp" type="number" value="${esc(s.notify_expiry_days||"0")}">
    <label>Traffic Cap Notification threshold (GB)</label>
    <input id="se_ntraf" type="number" value="${esc(s.notify_traffic_gb||"0")}">
    <span class="mut" style="display:block;margin-top:6px">0 = disabled. Sent via the Telegram bot when configured.</span>
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save_notify">${t("saveSettings")}</button></div>`;

  const external = `
    ${chk("se_ext_en", s.ext_traffic_enabled==="1", "Enable external traffic reporting")}
    <label>Report URL</label>
    <input id="se_ext_url" value="${esc(s.ext_traffic_url||"")}" placeholder="https://collector.example.com/report">
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save_ext">${t("saveSettings")}</button></div>`;

  const ldap = `
    ${chk("se_ld_en", s.ldap_enabled==="1", "Enable LDAP sync")}
    <div class="grid g2">
      <div><label>LDAP host</label><input id="se_ld_host" value="${esc(s.ldap_host||"")}"></div>
      <div><label>LDAP port</label><input id="se_ld_port" type="number" value="${esc(s.ldap_port||"389")}"></div>
    </div>
    ${chk("se_ld_tls", s.ldap_tls==="1", "Use TLS (LDAPS)")}
    ${chk("se_ld_skip", s.ldap_skip_verify==="1", "Skip TLS certificate verification (insecure)")}
    <label>Bind DN</label><input id="se_ld_bind" value="${esc(s.ldap_bind_dn||"")}">
    <label>Password ${s.ldap_password_set?"<span class='mut'>(set)</span>":""}</label><input id="se_ld_pass" type="password" placeholder="${s.ldap_password_set?"&bull;&bull;&bull;&bull;&bull;&bull;":"Not configured."}">
    <label>Base DN</label><input id="se_ld_base" value="${esc(s.ldap_base_dn||"")}">
    <label>User filter</label><input id="se_ld_filter" value="${esc(s.ldap_user_filter||"(objectClass=person)")}">
    <div class="grid g2">
      <div><label>User attribute</label><input id="se_ld_attr" value="${esc(s.ldap_user_attr||"mail")}"></div>
      <div><label>Flag attribute</label><input id="se_ld_flag" value="${esc(s.ldap_flag_attr||"vless_enabled")}"></div>
    </div>
    <label>Sync schedule</label><input id="se_ld_sync" value="${esc(s.ldap_sync_schedule||"@every 1m")}">
    <div class="grid g2">
      <div><label>Default total (GB)</label><input id="se_ld_gb" type="number" value="${esc(s.ldap_default_gb||"0")}"></div>
      <div><label>Default expiry (days)</label><input id="se_ld_days" type="number" value="${esc(s.ldap_default_days||"0")}"></div>
    </div>
    <div class="row" style="margin-top:16px"><button class="btn" id="se_save_ldap">${t("saveSettings")}</button></div>`;

  const telegram = `
    <div class="between"><span class="mut">${t("tgBotHint")}</span><span class="badge ${botOn?"on":"off"}">${botOn?t("running"):t("stopped")}</span></div>
    <label>${t("botToken")}</label><input id="se_bot" placeholder="${botOn?"&bull;&bull;&bull;&bull;&bull;&bull; ("+t("configured")+")":"123456:ABC-DEF…"}">
    <label>${t("botAdmins")}</label><input id="se_admins" value="${esc(s.bot_admins||"")}" placeholder="123456789,987654321">
    <div class="row" style="margin-top:16px"><button class="btn" id="se_botsave">${t("saveSettings")}</button></div>`;

  const backup = `
    <p class="mut" style="margin:2px 0 10px">Download or restore the SQLite database (settings, inbounds, clients).</p>
    <div class="row">
      <a class="btn ok" href="/api/backup" target="_blank" download style="text-decoration:none;display:inline-grid;place-items:center;min-width:140px">Download Backup</a>
      <button class="btn ghost" onclick="$('#restore_file').click()">Restore...</button>
      <input type="file" id="restore_file" hidden accept=".db,.sqlite">
    </div>`;

  $("#v-settings").innerHTML = `
    <div class="card"><h3>${t("settings")}</h3><span class="mut">Manage everything here — no need to edit anything on the server.</span></div>
    ${drawer(dh("&#9881;", t("setGeneral")),  general,  false, "dr-general")}
    ${drawer(dh("&#128272;", t("setAuth")),    auth,     false, "dr-auth")}
    ${drawer(dh("&#128274;", t("setCerts")),   certs,    false, "dr-certs")}
    ${drawer(dh("&#128197;", t("setDateTime")),datetime, false, "dr-datetime")}
    ${drawer(dh("&#128276;", t("setNotify")),  notify,   false, "dr-notify")}
    ${drawer(dh("&#127760;", t("setExternal")),external, false, "dr-external")}
    ${drawer(dh("&#128193;", t("setLdap")),    ldap,     false, "dr-ldap")}
    ${drawer(dh("&#129302;", t("setTelegram")),telegram, false, "dr-telegram")}
    ${drawer(dh("&#128190;", t("setBackup")),  backup,   false, "dr-backup")}`;

  const saveSet=async(obj)=>{ await api("settings",{method:"POST",body:JSON.stringify(obj)}); toast(t("saved")); load(); };
  const bit=(id)=>$("#"+id).checked?"1":"";

  $("#se_save_general").onclick=()=>saveSet({server_addr:$("#se_addr").value,panel_port:$("#se_port").value,panel_path:$("#se_path").value,
    listen_ip:$("#se_lip").value,listen_domain:$("#se_ldom").value,session_duration:$("#se_sess").value,pagination_size:$("#se_pag").value,
    trusted_cidrs:$("#se_cidr").value,panel_outbound:$("#se_pout").value,restart_after_disable:bit("se_rstdis"),
    dns_servers:$("#se_dns").value,sub_domain:$("#se_sdom").value,sub_port:$("#se_sport").value});
  $("#se_save_admin").onclick=()=>saveSet({new_username:$("#se_user").value||undefined,new_password:$("#se_pass").value||undefined});
  $("#se_save_certs").onclick=()=>saveSet({cert_file:$("#se_cert").value,key_file:$("#se_key").value});
  $("#se_save_dt").onclick=()=>saveSet({timezone:$("#se_tz").value,calendar:$("#se_cal").value});
  $("#se_save_notify").onclick=()=>saveSet({notify_expiry_days:$("#se_nexp").value,notify_traffic_gb:$("#se_ntraf").value});
  $("#se_save_ext").onclick=()=>saveSet({ext_traffic_enabled:bit("se_ext_en"),ext_traffic_url:$("#se_ext_url").value});
  $("#se_save_ldap").onclick=()=>{ const o={ldap_enabled:bit("se_ld_en"),ldap_host:$("#se_ld_host").value,ldap_port:$("#se_ld_port").value,
    ldap_tls:bit("se_ld_tls"),ldap_skip_verify:bit("se_ld_skip"),ldap_bind_dn:$("#se_ld_bind").value,ldap_base_dn:$("#se_ld_base").value,
    ldap_user_filter:$("#se_ld_filter").value,ldap_user_attr:$("#se_ld_attr").value,ldap_flag_attr:$("#se_ld_flag").value,
    ldap_sync_schedule:$("#se_ld_sync").value,ldap_default_gb:$("#se_ld_gb").value,ldap_default_days:$("#se_ld_days").value};
    if($("#se_ld_pass").value)o.ldap_password=$("#se_ld_pass").value; saveSet(o); };
  $("#se_botsave").onclick=()=>{ const b={bot_admins:$("#se_admins").value}; if($("#se_bot").value.trim())b.bot_token=$("#se_bot").value.trim(); saveSet(b); };

  // ── API token actions ──
  if($("#tk_gen")) $("#tk_gen").onclick=async()=>{ const r=await api("api-token",{method:"POST"}); if(r&&r.api_token){ $("#se_apitok").value=r.api_token; toast(t("saved")); load(); } };
  if($("#tk_copy")) $("#tk_copy").onclick=()=>copy($("#se_apitok").value);
  if($("#tk_revoke")) $("#tk_revoke").onclick=async()=>{ await api("api-token",{method:"DELETE"}); toast(t("saved")); load(); };

  // ── 2FA actions ──
  if($("#tf_disable")) $("#tf_disable").onclick=async()=>{ await api("2fa/disable",{method:"POST"}); toast("2FA disabled"); load(); };
  if($("#tf_setup")) $("#tf_setup").onclick=async()=>{
    const r=await api("2fa/setup",{method:"POST"}); if(!r||!r.secret){ toast("setup failed"); return; }
    $("#twofa_area").innerHTML=`
      <div class="card" style="margin:8px 0">
        <p class="mut">Scan this QR in your authenticator app, then enter the 6-digit code to confirm.</p>
        <div id="tf_qr" class="qr" style="margin:10px 0"></div>
        <p class="mut">Manual secret: <code>${esc(r.secret)}</code></p>
        <label>Confirmation code</label><input id="tf_code" inputmode="numeric" placeholder="123456">
        <div class="row" style="margin-top:12px"><button class="btn sm" id="tf_confirm">Confirm &amp; enable</button></div>
      </div>`;
    try{ new QRCode($("#tf_qr"),{text:r.uri,width:150,height:150}); }catch(e){ $("#tf_qr").textContent=r.uri; }
    $("#tf_confirm").onclick=async()=>{ const rr=await api("2fa/enable",{method:"POST",body:JSON.stringify({otp:$("#tf_code").value})});
      if(rr&&rr.ok){ toast("2FA enabled"); load(); } else { toast("Invalid code"); } };
  };

  $("#restore_file").onchange=async(e)=>{
    const file=e.target.files[0]; if(!file)return;
    const r=await fetch("/api/restore",{method:"POST",body:file});
    if(r.ok){ toast("Restored! Restarting panel..."); setTimeout(()=>location.reload(), 2000); } else { toast("Restore failed"); }
  };

  // open + scroll to the section chosen from the sidebar dropdown
  const active = SETTINGS_TAB || "general";
  const dr = $("#dr-"+active);
  if(dr){ dr.classList.add("open"); setTimeout(()=>{ try{ dr.scrollIntoView({behavior:"smooth",block:"start"}); }catch(e){} }, 60); }
}

/* ---------- logs ---------- */
async function renderLogs(){
  const d=await api("logs").catch(()=>({logs:[]}));
  let h=`<div class="card"><div class="between"><h3 style="margin:0">${t("logs")}</h3><button class="btn ghost sm" onclick="renderLogs()">&#8635;</button></div>`;
  if(!d.logs||!d.logs.length) h+=`<p class="mut">${t("noItems")}</p>`;
  (d.logs||[]).forEach(l=>{ h+=`<div class="logrow"><span class="pill">${esc(l.type)}</span><span style="flex:1">${esc(l.detail)}</span>
    <span class="mut">${esc((l.ts||"").replace("T"," ").slice(0,19))}</span>${l.ip?`<span class="mut">${esc(l.ip)}</span>`:""}</div>`; });
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
// mobile: hamburger opens the off-canvas sidebar; scrim / close button dismiss it
$("#menuToggle").onclick=openSidebar;
if($("#sideClose")) $("#sideClose").onclick=closeSidebar;
if($("#sideScrim")) $("#sideScrim").onclick=closeSidebar;
// duplicated topbar controls (visible on mobile)
if($("#themeBtn2")) $("#themeBtn2").onclick=()=>setTheme(THEME==="dark"?"light":"dark");
fillLangSel("#langSel");
fillLangSel("#langSel2");
fillLangSel("#loginLangSel");
applyChrome();
load();
