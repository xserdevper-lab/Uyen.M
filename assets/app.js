(function () {
  "use strict";
  const config = Object.assign({ apiUrl: "", walletId: "uyen", refreshMs: 30000 }, window.WALLET_CONFIG || {});
  const money = new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", minimumFractionDigits: 2 });
  const shortDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const $ = (id) => document.getElementById(id);
  const elements = { balance: $("balance"), displayName: $("displayName"), lastSync: $("lastSync"), list: $("transactionList"), status: $("statusChip"), installButton: $("installButton"), refresh: $("refreshButton"), requestDialog: $("requestDialog"), infoDialog: $("infoDialog"), requestForm: $("requestForm"), submitRequest: $("submitRequest"), formMessage: $("formMessage") };
  let installPrompt = null;

  function showStatus(message) { elements.status.textContent = message; elements.status.hidden = !message; }
  function safe(value, fallback = "") { return String(value == null ? fallback : value).trim().slice(0, 200); }

  function renderWallet(data) {
    elements.displayName.textContent = safe(data.displayName, "Uyen Nguyen");
    elements.balance.textContent = money.format(Number(data.balance || 0));
    elements.lastSync.textContent = `ซิงก์ ${shortDate.format(data.updatedAt ? new Date(data.updatedAt) : new Date())}`;
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    if (!transactions.length) {
      elements.list.innerHTML = '<div class="empty-state"><div class="empty-icon">↗</div><p>ยังไม่มีรายการ</p><span>เมื่อแอปเงินรวมจ่ายเงิน รายการจะแสดงที่นี่</span></div>';
      return;
    }
    elements.list.replaceChildren(...transactions.slice(0, 8).map(renderTransaction));
  }

  function renderTransaction(item) {
    const isCredit = String(item.type || "credit").toLowerCase() === "credit";
    const row = document.createElement("article"); row.className = "transaction";
    const icon = document.createElement("div"); icon.className = "transaction-icon"; icon.textContent = isCredit ? "↙" : "↗";
    const info = document.createElement("div");
    const title = document.createElement("p"); title.className = "transaction-title"; title.textContent = safe(item.note, isCredit ? "รับเงินจากแอปเงินรวม" : "รายการจ่าย");
    const meta = document.createElement("p"); meta.className = "transaction-meta"; meta.textContent = safe(item.source, isCredit ? "แอปเงินรวม" : "Uyen.M");
    info.append(title, meta);
    const amount = document.createElement("div"); amount.className = `transaction-amount ${isCredit ? "credit" : "debit"}`; amount.textContent = `${isCredit ? "+" : "−"} ${money.format(Math.abs(Number(item.amount || 0)))}`;
    const date = document.createElement("span"); date.className = "transaction-date"; date.textContent = item.createdAt ? shortDate.format(new Date(item.createdAt)) : "";
    amount.append(date); row.append(icon, info, amount); return row;
  }

  async function apiGet(params) {
    const url = new URL(config.apiUrl);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { redirect: "follow", cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!payload.ok) throw new Error(payload.error || "API error");
    return payload.data;
  }

  async function loadWallet() {
    if (!config.apiUrl) {
      showStatus("ยังไม่ได้เชื่อม Google Sheet — เปิด ?demo=1 เพื่อดูตัวอย่าง หรือใส่ Apps Script URL ใน config.js");
      if (new URLSearchParams(location.search).get("demo") === "1") {
        showStatus("โหมดตัวอย่าง — ยอดจริงจะอ่านจาก Google Sheet หลังเชื่อม Apps Script");
        renderWallet({ displayName: "Uyen Nguyen", balance: 2000, updatedAt: new Date().toISOString(), transactions: [{ type: "credit", amount: 2000, note: "รับเงินค่าประจำสัปดาห์", source: "แอปเงินรวม", createdAt: new Date().toISOString() }] });
      }
      return;
    }
    elements.refresh.disabled = true;
    try { showStatus(""); renderWallet(await apiGet({ action: "wallet", walletId: config.walletId })); }
    catch (error) { console.error(error); showStatus("ซิงก์ Google Sheet ไม่สำเร็จ กรุณาตรวจ URL และสิทธิ์ของ Apps Script"); }
    finally { elements.refresh.disabled = false; }
  }

  async function submitRequest(event) {
    event.preventDefault(); elements.formMessage.className = "form-message";
    if (!config.apiUrl) { elements.formMessage.textContent = "กรุณาเชื่อม Apps Script ก่อนส่งคำขอ"; elements.formMessage.classList.add("error"); return; }
    elements.submitRequest.disabled = true; elements.formMessage.textContent = "กำลังส่ง...";
    try {
      const body = new URLSearchParams({ action: "request", walletId: config.walletId, amount: $("requestAmount").value, note: $("requestNote").value });
      const response = await fetch(config.apiUrl, { method: "POST", body, redirect: "follow" });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "ส่งคำขอไม่สำเร็จ");
      elements.requestForm.reset(); elements.formMessage.textContent = "ส่งคำขอแล้ว ยอดเงินจะยังไม่เปลี่ยนจนกว่าแอปหลักจะจ่ายให้"; elements.formMessage.classList.add("success");
    } catch (error) { elements.formMessage.textContent = safe(error.message, "ส่งคำขอไม่สำเร็จ"); elements.formMessage.classList.add("error"); }
    finally { elements.submitRequest.disabled = false; }
  }

  function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
  document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  $("requestButton").addEventListener("click", () => openDialog(elements.requestDialog));
  $("navRequest").addEventListener("click", () => openDialog(elements.requestDialog));
  $("infoButton").addEventListener("click", () => openDialog(elements.infoDialog));
  $("historyButton").addEventListener("click", () => $("activitySection").scrollIntoView({ behavior: "smooth" }));
  $("navWallet").addEventListener("click", () => document.querySelector(".balance-card").scrollIntoView({ behavior: "smooth" }));
  elements.refresh.addEventListener("click", loadWallet); elements.requestForm.addEventListener("submit", submitRequest);
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event; elements.installButton.hidden = false; });
  elements.installButton.addEventListener("click", async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; elements.installButton.hidden = true; });
  window.addEventListener("appinstalled", () => { installPrompt = null; elements.installButton.hidden = true; });
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  loadWallet(); if (config.apiUrl && Number(config.refreshMs) >= 10000) setInterval(loadWallet, Number(config.refreshMs));
}());


