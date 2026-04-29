// Debt Management Module
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const db = getFirestore();

// DOM Elements
const debtForm = document.getElementById("debtForm");
const modeOweBtn = document.getElementById("modeOweBtn");
const modeReceiveBtn = document.getElementById("modeReceiveBtn");
const counterpartyWhatsappEl = document.getElementById("counterpartyWhatsapp");
const penaltyFieldsEl = document.getElementById("penaltyFields");
const penaltyPerDayEl = document.getElementById("penaltyPerDay");
const debtImagesInputEl = document.getElementById("debtImagesInput");
const debtList = document.getElementById("debtList");
const totalBorrowedEl = document.getElementById("totalBorrowed");
const totalPaidEl = document.getElementById("totalPaid");
const totalDebtEl = document.getElementById("totalDebt");
const insightTextEl = document.getElementById("insightText");
const activeTabBtn = document.getElementById("activeTabBtn");
const settledTabBtn = document.getElementById("settledTabBtn");
const searchInput = document.getElementById("searchInput");
const statusFilterEl = document.getElementById("statusFilter");
const interestTypeEl = document.getElementById("interestType");
const interestFieldsEl = document.getElementById("interestFields");
const debtCardTemplate = document.getElementById("debtCardTemplate");

// State
let debts = [];
let searchQuery = "";
let statusFilter = "all";
let currentTab = "active";
let debtSide = "owe";
let unsubscribeDebts = null;

// Utility Functions
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0
  );

const formatDate = (dateString) =>
  Number.isNaN(new Date(dateString).getTime())
    ? "N/A"
    : new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(dateString));

function getWhatsAppLink(phone, message) {
  const digits = String(phone || "")
    .replace(/\s+/g, "")
    .replace(/[^0-9]/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function openImageModal(dataUrl) {
  if (!dataUrl) return;
  const imageModalEl = document.getElementById("imageModal");
  const imageModalImg = document.getElementById("imageModalImg");
  imageModalImg.src = dataUrl;
  imageModalEl.classList.remove("hidden");
  imageModalEl.classList.add("flex");
}

function closeImageModal() {
  const imageModalEl = document.getElementById("imageModal");
  const imageModalImg = document.getElementById("imageModalImg");
  imageModalImg.src = "";
  imageModalEl.classList.add("hidden");
  imageModalEl.classList.remove("flex");
}

function readFilesAsDataUrls(fileList) {
  const files = Array.from(fileList || []);
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve({
              id: crypto.randomUUID(),
              name: file.name,
              dataUrl: String(reader.result || ""),
              uploadedAt: new Date().toISOString(),
            });
          reader.onerror = () => reject(new Error("File read failed"));
          reader.readAsDataURL(file);
        })
    )
  );
}

// Debt Calculations
function calculateInterestAdjustedTotal(debt) {
  const base = Number(debt.amountBorrowed) || 0;
  if (debt.interestType !== "fixed") return base;
  const rate = Number(debt.interestRate) || 0;
  const afterMonths = Number(debt.interestAfterMonths) || 0;
  if (rate <= 0 || afterMonths <= 0) return base;
  const borrowed = new Date(debt.dateBorrowed);
  const trigger = new Date(borrowed);
  trigger.setMonth(trigger.getMonth() + afterMonths);
  return new Date() >= trigger ? base + base * (rate / 100) : base;
}

function getDebtMeta(debt) {
  const currentTotal = calculateInterestAdjustedTotal(debt);
  const paid = (debt.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = Math.max(currentTotal - paid, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(debt.deadlineDate);
  deadline.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  const side = debt.side || "owe";
  const penaltyPerDay = Number(debt.penaltyPerDay) || 0;
  const delayDays = side === "receive" ? Math.max(0, -daysRemaining) : 0;
  const penaltyDue = side === "receive" ? delayDays * penaltyPerDay : 0;
  return {
    currentTotal,
    paid,
    remaining,
    daysRemaining,
    delayDays,
    penaltyDue,
    isPaid: remaining <= 0,
    isOverdue: daysRemaining < 0 && remaining > 0,
    isUpcoming: daysRemaining >= 0 && daysRemaining <= 7 && remaining > 0,
    paidPercent: currentTotal > 0 ? Math.min((paid / currentTotal) * 100, 100) : 0,
  };
}

// Rendering Functions
function renderSummary() {
  const metasByDebtId = new Map();
  debts.forEach((d) => metasByDebtId.set(d.id, getDebtMeta(d)));

  const iOwe = debts
    .filter((d) => (d.side || "owe") === "owe")
    .reduce((sum, d) => sum + (metasByDebtId.get(d.id)?.remaining || 0), 0);

  const iReceive = debts
    .filter((d) => (d.side || "owe") === "receive")
    .reduce((sum, d) => sum + (metasByDebtId.get(d.id)?.remaining || 0), 0);

  totalBorrowedEl.textContent = formatCurrency(iOwe);
  totalPaidEl.textContent = formatCurrency(iReceive);
  totalDebtEl.textContent = "PKR 0"; // VC savings will be handled separately

  renderInsight();
}

function renderInsight() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const prevDate = new Date(currentYear, currentMonth - 1, 1);
  const prevMonth = prevDate.getMonth();
  const prevYear = prevDate.getFullYear();
  let thisMonth = 0;
  let lastMonth = 0;
  debts.forEach((debt) =>
    (debt.payments || []).forEach((p) => {
      const d = new Date(p.paidAt);
      const amount = Number(p.amount) || 0;
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) thisMonth += amount;
      if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) lastMonth += amount;
    })
  );
  if (thisMonth === 0 && lastMonth === 0) insightTextEl.textContent = "Smart Insight: Add payments to see progress compared to last month.";
  else if (lastMonth === 0) insightTextEl.textContent = `Smart Insight: Great start! You paid ${formatCurrency(thisMonth)} this month.`;
  else {
    const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
    insightTextEl.textContent =
      pct >= 0
        ? `Smart Insight: You paid ${pct}% more debt this month than last month!`
        : `Smart Insight: You paid ${Math.abs(pct)}% less than last month. Keep going!`;
  }
}

function matchesFilters(debt, meta) {
  const side = debt.side || "owe";
  if (side !== debtSide) return false;

  if (currentTab === "settled" && !meta.isPaid) return false;
  if (currentTab === "active" && meta.isPaid) return false;
  if (!debt.lenderName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
  if (currentTab === "settled" || statusFilter === "all") return true;
  if (statusFilter === "pending") return !meta.isPaid && !meta.isOverdue;
  if (statusFilter === "overdue") return meta.isOverdue;
  return true;
}

function renderPaymentHistory(historyListEl, debt) {
  const payments = (debt.payments || []).slice().sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
  if (!payments.length) {
    historyListEl.innerHTML = `<li class="text-slate-500">No payments yet.</li>`;
    return;
  }
  historyListEl.innerHTML = payments
    .slice(0, 5)
    .map(
      (payment) => `<li class="flex items-center justify-between rounded-lg bg-white px-3 py-2">
        <div><p class="text-xs text-slate-500">${formatDate(payment.paidAt)}</p><p class="sensitive font-semibold">${formatCurrency(
          Number(payment.amount) || 0
        )}</p></div>
        <button data-payment-id="${payment.id}" class="history-delete-btn rounded border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600">Delete</button>
      </li>`
    )
    .join("");
  historyListEl.querySelectorAll(".history-delete-btn").forEach((btn) =>
    btn.addEventListener("click", async () => {
      if (!window.confirm("Delete this payment?")) return;
      await removePayment(debt.id, btn.getAttribute("data-payment-id"));
    })
  );
}

function renderDebts() {
  debtList.innerHTML = "";
  const filtered = debts.filter((d) => matchesFilters(d, getDebtMeta(d)));
  if (!filtered.length) {
    debtList.innerHTML = `<div class="rounded-2xl border border-dashed bg-white p-8 text-center text-slate-500">${
      currentTab === "settled" ? "No settled debts yet." : "No debts found."
    }</div>`;
    return;
  }
  filtered
    .slice()
    .sort((a, b) => new Date(a.deadlineDate) - new Date(b.deadlineDate))
    .forEach((debt) => {
      const meta = getDebtMeta(debt);
      const card = debtCardTemplate.content.cloneNode(true);
      const article = card.querySelector("article");
      if (meta.isOverdue) article.classList.add("border-rose-300", "bg-rose-50/40");
      card.querySelector(".debt-name").textContent = debt.lenderName;
      card.querySelector(".borrowed-amount").textContent = formatCurrency(Number(debt.amountBorrowed));
      card.querySelector(".current-total").textContent = formatCurrency(meta.currentTotal);
      card.querySelector(".paid-amount").textContent = formatCurrency(meta.paid);
      card.querySelector(".remaining-amount").textContent = formatCurrency(meta.remaining);
      card.querySelector(".borrowed-date").textContent = formatDate(debt.dateBorrowed);
      card.querySelector(".deadline-date").textContent = formatDate(debt.deadlineDate);
      card.querySelector(".interest-details").textContent =
        debt.interestType === "fixed" ? `${debt.interestRate}% after ${debt.interestAfterMonths} month(s)` : "None";
      const side = debt.side || "owe";
      if (meta.isPaid) {
        card.querySelector(".days-remaining").textContent = side === "receive" ? "Collected" : "Settled";
      } else if (side === "receive" && meta.delayDays > 0) {
        card.querySelector(".days-remaining").textContent = `${meta.delayDays} day(s) delayed`;
      } else {
        card.querySelector(".days-remaining").textContent = `${meta.daysRemaining} day(s)`;
      }
      card.querySelector(".progress-percent").textContent = `${Math.round(meta.paidPercent)}%`;
      card.querySelector(".progress-fill").style.width = `${meta.paidPercent}%`;
      card.querySelector(".deadline-badge").textContent = meta.isPaid ? "Settled" : meta.isOverdue ? "Overdue" : "Active";

      // Penalty row (only for receivables when overdue)
      const penaltyRow = card.querySelector(".penalty-row");
      if (side === "receive" && meta.delayDays > 0 && Number(debt.penaltyPerDay) > 0 && meta.remaining > 0) {
        penaltyRow.classList.remove("hidden");
        penaltyRow.querySelector(".penalty-details").textContent = formatCurrency(meta.penaltyDue);
      } else {
        penaltyRow.classList.add("hidden");
        penaltyRow.querySelector(".penalty-details").textContent = "";
      }

      // Attachments thumbnails
      const attachments = Array.isArray(debt.attachments) ? debt.attachments : [];
      const attachmentsWrap = card.querySelector(".debt-attachments");
      attachmentsWrap.innerHTML = "";
      if (attachments.length) {
        attachments.slice(0, 3).forEach((att) => {
          const dataUrl = att.dataUrl || att.url || "";
          if (!dataUrl) return;
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "attachment-thumb rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50";
          btn.innerHTML = `<img src="${dataUrl}" alt="Attachment" class="h-10 w-10 rounded-lg object-cover" />`;
          btn.addEventListener("click", () => openImageModal(dataUrl));
          attachmentsWrap.appendChild(btn);
        });
      }

      renderPaymentHistory(card.querySelector(".history-list"), debt);

      const payInput = card.querySelector(".payment-input");
      const payBtn = card.querySelector(".pay-btn");
      if (meta.isPaid) {
        payInput.disabled = true;
        payBtn.disabled = true;
      }
      payBtn.addEventListener("click", async () => {
        const amount = Number(payInput.value);
        if (!amount || amount <= 0 || amount > meta.remaining) return window.alert("Invalid payment amount.");
        const payments = [...(debt.payments || []), { id: crypto.randomUUID(), amount, paidAt: new Date().toISOString() }];
        await updateDoc(doc(db, "debts", debt.id), { payments });
      });

      card.querySelector(".delete-btn").addEventListener("click", async () => {
        if (!window.confirm("Delete this debt record?")) return;
        await deleteDoc(doc(db, "debts", debt.id));
      });
      card.querySelector(".receipt-btn").addEventListener("click", () => downloadDebtReceipt(debt, meta));

      const waBtn = card.querySelector(".wa-btn");
      if (waBtn) {
        waBtn.addEventListener("click", () => {
          const phone = debt.whatsapp || debt.counterpartyWhatsapp || "";
          const name = debt.lenderName || "Friend";
          const amountText = formatCurrency(meta.remaining);
          const message = `Assalam-o-Alaikum ${name}, this is a reminder for your Karza installment of ${amountText}. Please clear it soon.`;
          const url = getWhatsAppLink(phone, message);
          if (!url) return window.alert("WhatsApp number missing for this entry.");
          window.open(url, "_blank");
        });
      }
      debtList.appendChild(card);
    });
  if (window.lucide) window.lucide.createIcons();
}

async function removePayment(debtId, paymentId) {
  const debt = debts.find((d) => d.id === debtId);
  if (!debt) return;
  const payments = (debt.payments || []).filter((p) => p.id !== paymentId);
  await updateDoc(doc(db, "debts", debtId), { payments });
}

function setTab(tab) {
  currentTab = tab;
  activeTabBtn.className = tab === "active" ? "rounded-lg bg-white px-3 py-1.5 text-sm font-semibold" : "rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600";
  settledTabBtn.className = tab === "settled" ? "rounded-lg bg-white px-3 py-1.5 text-sm font-semibold" : "rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600";
  renderDebts();
}

function handleInterestVisibility() {
  const fixed = interestTypeEl.value === "fixed";
  interestFieldsEl.classList.toggle("hidden", !fixed);
  document.getElementById("interestRate").required = fixed;
  document.getElementById("interestAfterMonths").required = fixed;
}

function downloadDebtReceipt(debt, meta) {
  if (!window.jspdf?.jsPDF) return;
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF();
  let y = 20;
  docPdf.setFontSize(16);
  docPdf.text("Karza Payment Receipt", 14, y);
  y += 10;
  [ 
    `Lender: ${debt.lenderName}`,
    `Borrowed: ${formatCurrency(Number(debt.amountBorrowed) || 0)}`,
    `Current Total: ${formatCurrency(meta.currentTotal)}`,
    `Paid: ${formatCurrency(meta.paid)}`,
    `Remaining: ${formatCurrency(meta.remaining)}`
  ].forEach((line) => { docPdf.text(line, 14, y); y += 7; });
  y += 2;
  docPdf.text("Payments:", 14, y);
  y += 7;
  (debt.payments || []).forEach((p, i) => {
    docPdf.text(`${i + 1}. ${formatDate(p.paidAt)} - ${formatCurrency(Number(p.amount) || 0)}`, 14, y);
    y += 6;
  });
  docPdf.save(`karza-receipt-${debt.lenderName.replace(/[^a-z0-9]/gi, "_")}.pdf`);
}

function applyDebtModeUI(mode) {
  debtSide = mode;
  const lenderNameEl = document.getElementById("lenderName");
  if (mode === "owe") {
    modeOweBtn.className = "w-1/2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800";
    modeReceiveBtn.className = "w-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600";
    if (penaltyFieldsEl) penaltyFieldsEl.classList.add("hidden");
    if (lenderNameEl) lenderNameEl.placeholder = "Lender Name (whom you owe)";
  } else {
    modeOweBtn.className = "w-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600";
    modeReceiveBtn.className = "w-1/2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800";
    if (penaltyFieldsEl) penaltyFieldsEl.classList.remove("hidden");
    if (lenderNameEl) lenderNameEl.placeholder = "Borrower Name (who owes you)";
  }
  renderDebts();
}

// Firestore Integration
function bindDebtFirestore(user) {
  if (unsubscribeDebts) unsubscribeDebts();
  unsubscribeDebts = onSnapshot(query(collection(db, "debts"), where("userId", "==", user.uid)), (snap) => {
    debts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSummary();
    renderDebts();
  });
}

// Event Listeners
function initializeDebtModule() {
  // Form submission
  debtForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const user = window.authModule?.currentUser;
    if (!user) return;
    const data = new FormData(debtForm);
    const attachments = await readFilesAsDataUrls(debtImagesInputEl?.files);
    const side = debtSide;
    const penaltyPerDay = side === "receive" ? Number(data.get("penaltyPerDay")) || 0 : 0;
    const payload = {
      userId: user.uid,
      side,
      lenderName: String(data.get("lenderName") || "").trim(),
      amountBorrowed: Number(data.get("amountBorrowed")),
      dateBorrowed: data.get("dateBorrowed"),
      deadlineDate: data.get("deadlineDate"),
      whatsapp: String(data.get("counterpartyWhatsapp") || "").trim(),
      penaltyPerDay,
      interestType: data.get("interestType"),
      interestRate: Number(data.get("interestRate")) || 0,
      interestAfterMonths: Number(data.get("interestAfterMonths")) || 0,
      attachments,
      payments: [],
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db, "debts"), payload);
    debtForm.reset();
    handleInterestVisibility();
    applyDebtModeUI(debtSide);
    if (debtImagesInputEl) debtImagesInputEl.value = "";
  });

  // UI Controls
  interestTypeEl.addEventListener("change", handleInterestVisibility);
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderDebts();
  });
  statusFilterEl.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    renderDebts();
  });
  activeTabBtn.addEventListener("click", () => setTab("active"));
  settledTabBtn.addEventListener("click", () => setTab("settled"));

  if (modeOweBtn) modeOweBtn.addEventListener("click", () => applyDebtModeUI("owe"));
  if (modeReceiveBtn) modeReceiveBtn.addEventListener("click", () => applyDebtModeUI("receive"));

  // Image modal
  const imageModalCloseBtn = document.getElementById("imageModalCloseBtn");
  const imageModalEl = document.getElementById("imageModal");
  if (imageModalCloseBtn) {
    imageModalCloseBtn.addEventListener("click", closeImageModal);
  }
  if (imageModalEl) {
    imageModalEl.addEventListener("click", (e) => {
      if (e.target === imageModalEl) closeImageModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeImageModal();
    });
  }

  // Initialize UI
  applyDebtModeUI("owe");
  handleInterestVisibility();
  setTab("active");
}

// Listen for auth state changes
window.addEventListener('authStateChanged', (event) => {
  const user = event.detail.user;
  if (user) {
    bindDebtFirestore(user);
  } else {
    debts = [];
    renderDebts();
  }
});

// Export for use in other modules
export {
  debts,
  formatCurrency,
  formatDate,
  renderSummary,
  initializeDebtModule,
  bindDebtFirestore
};
