import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC3czgVGRYos9u4B3cKDpsqL4Q9NRqolg4",
  authDomain: "karza-app.firebaseapp.com",
  projectId: "karza-app",
  storageBucket: "karza-app.firebasestorage.app",
  messagingSenderId: "273414460198",
  appId: "1:273414460198:web:20ab07b7340a8af69fa7e7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const STORAGE_KEY = "karza-debts";
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const modeOweBtn = document.getElementById("modeOweBtn");
const modeReceiveBtn = document.getElementById("modeReceiveBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const debtForm = document.getElementById("debtForm");
const counterpartyWhatsappEl = document.getElementById("counterpartyWhatsapp");
const penaltyFieldsEl = document.getElementById("penaltyFields");
const penaltyPerDayEl = document.getElementById("penaltyPerDay");
const debtImagesInputEl = document.getElementById("debtImagesInput");
const vcImagesInputEl = document.getElementById("vcImagesInput");
const imageModalEl = document.getElementById("imageModal");
const imageModalImg = document.getElementById("imageModalImg");
const imageModalCloseBtn = document.getElementById("imageModalCloseBtn");
const committeeForm = document.getElementById("committeeForm");
const debtList = document.getElementById("debtList");
const committeeList = document.getElementById("committeeList");
const addMemberBtn = document.getElementById("addMemberBtn");
const membersInputsEl = document.getElementById("membersInputs");
const vcDetailsPanel = document.getElementById("vcDetailsPanel");
const vcDetailsName = document.getElementById("vcDetailsName");
const vcDetailsMeta = document.getElementById("vcDetailsMeta");
const vcTabOverviewBtn = document.getElementById("vcTabOverviewBtn");
const vcTabPaymentsBtn = document.getElementById("vcTabPaymentsBtn");
const vcTabScheduleBtn = document.getElementById("vcTabScheduleBtn");
const vcTabOverviewEl = document.getElementById("vcTabOverviewEl");
const vcTabPaymentsEl = document.getElementById("vcTabPaymentsEl");
const vcTabScheduleEl = document.getElementById("vcTabScheduleEl");
const totalBorrowedEl = document.getElementById("totalBorrowed");
const totalPaidEl = document.getElementById("totalPaid");
const totalDebtEl = document.getElementById("totalDebt");
const upcomingDeadlinesEl = document.getElementById("upcomingDeadlines");
const overdueCountEl = document.getElementById("overdueCount");
const interestTypeEl = document.getElementById("interestType");
const interestFieldsEl = document.getElementById("interestFields");
const searchInput = document.getElementById("searchInput");
const statusFilterEl = document.getElementById("statusFilter");
const privacyToggleBtn = document.getElementById("privacyToggleBtn");
const insightTextEl = document.getElementById("insightText");
const activeTabBtn = document.getElementById("activeTabBtn");
const settledTabBtn = document.getElementById("settledTabBtn");
const pdfReportBtn = document.getElementById("pdfReportBtn");
const debtCardTemplate = document.getElementById("debtCardTemplate");

let currentUser = null;
let debts = [];
let committees = [];
let searchQuery = "";
let statusFilter = "all";
let currentTab = "active";
let debtSide = "owe"; // "owe" => I Owe, "receive" => People Owe Me
let unsubscribeDebts = null;
let unsubscribeCommittees = null;
let selectedCommitteeId = null;
let selectedVcTab = "overview";
let selectedMonthNo = 1;
let monthPaymentsUnsub = null;
let monthPaymentsByMonth = {};

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
  imageModalImg.src = dataUrl;
  imageModalEl.classList.remove("hidden");
  imageModalEl.classList.add("flex");
}

function closeImageModal() {
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

function renderSummary() {
  const metasByDebtId = new Map();
  debts.forEach((d) => metasByDebtId.set(d.id, getDebtMeta(d)));

  const iOwe = debts
    .filter((d) => (d.side || "owe") === "owe")
    .reduce((sum, d) => sum + (metasByDebtId.get(d.id)?.remaining || 0), 0);

  const iReceive = debts
    .filter((d) => (d.side || "owe") === "receive")
    .reduce((sum, d) => sum + (metasByDebtId.get(d.id)?.remaining || 0), 0);

  const vcSavings = committees.reduce((sum, c) => {
    const monthlyInstallment = Number(c.monthlyInstallment) || 0;
    const paidMonthNumbers = Array.isArray(c.paidMonthNumbers) ? c.paidMonthNumbers : [];
    return sum + monthlyInstallment * paidMonthNumbers.length;
  }, 0);

  totalBorrowedEl.textContent = formatCurrency(iOwe);
  totalPaidEl.textContent = formatCurrency(iReceive);
  totalDebtEl.textContent = formatCurrency(vcSavings);

  // Keep insight line; it still uses payment history.
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

      // Attachments thumbnails (base64 data URLs)
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
  lucide.createIcons();

  // Keep details panel in sync with the latest committee snapshot.
  if (selectedCommitteeId) {
    renderVcDetails();
  }
}

function renderCommittees() {
  committeeList.innerHTML = "";

  if (!committees.length) {
    committeeList.innerHTML = `<div class="rounded-xl border border-dashed p-4 text-sm text-slate-500">No VC committees yet.</div>`;
    vcDetailsPanel.classList.add("hidden");
    return;
  }

  // If selected VC is deleted, clear selection.
  if (selectedCommitteeId && !committees.some((c) => c.id === selectedCommitteeId)) {
    selectedCommitteeId = null;
    monthPaymentsByMonth = {};
    if (monthPaymentsUnsub) monthPaymentsUnsub();
    monthPaymentsUnsub = null;
    vcDetailsPanel.classList.add("hidden");
  }

  // Left panel: committee cards
  committees
    .slice()
    .sort((a, b) => String(a.vcName || "").localeCompare(String(b.vcName || "")))
    .forEach((c) => {
      const memberCount = Array.isArray(c.members) ? c.members.length : 0;
      const totalMonths = Number(c.totalMonths) || 0;
      const totalAmount = Number(c.totalAmount) || 0;
      const monthlyInstallment = Number(c.monthlyInstallment) || 0;

      const card = document.createElement("div");
      card.setAttribute("role", "button");
      card.tabIndex = 0;
      card.className = `text-left rounded-xl border bg-white p-3 shadow-sm transition hover:bg-slate-50 ${
        c.id === selectedCommitteeId ? "border-brand-300 ring-1 ring-brand-200" : "border-slate-200"
      }`;
      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-slate-900">${c.vcName || "Untitled VC"}</p>
            <p class="mt-1 text-xs text-slate-600">
              Total: ${formatCurrency(totalAmount)} | ${formatCurrency(monthlyInstallment)} x ${totalMonths} months
            </p>
            <p class="mt-1 text-xs text-slate-500">Members: ${memberCount}</p>
          </div>
          <div class="shrink-0">
            <span class="inline-flex items-center rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
              Manage
            </span>
          </div>
        </div>
        <div class="mt-2 flex gap-2">
          <button data-action="delete" type="button" class="committee-delete-btn ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
            <i data-lucide="trash-2" class="h-3.5 w-3.5"></i>
            Delete
          </button>
        </div>
      `;

      card.addEventListener("click", (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && target.closest("[data-action='delete']")) {
          // Delete button handles separately.
          return;
        }
        selectCommittee(c.id);
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectCommittee(c.id);
        }
      });

      const deleteBtn = card.querySelector("[data-action='delete']");
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!window.confirm("Delete this VC committee record?")) return;
        await deleteDoc(doc(db, "committees", c.id));
      });

      committeeList.appendChild(card);
    });

  lucide.createIcons();
}

function selectCommittee(committeeId) {
  selectedCommitteeId = committeeId;
  selectedVcTab = "overview";
  const c = committees.find((x) => x.id === committeeId);
  selectedMonthNo = Math.max(1, Number(c?.currentPayoutMonth) || 1);

  vcDetailsPanel.classList.remove("hidden");
  setVcTab("overview");
  renderVcDetails();

  if (monthPaymentsUnsub) monthPaymentsUnsub();
  monthPaymentsByMonth = {};

  const mpRef = collection(db, "committees", committeeId, "monthPayments");
  monthPaymentsUnsub = onSnapshot(mpRef, (snap) => {
    const nextMap = {};
    snap.forEach((docSnap) => {
      const monthNo = Number(docSnap.id);
      if (!Number.isFinite(monthNo)) return;
      const data = docSnap.data() || {};
      nextMap[monthNo] = { paidMemberIds: Array.isArray(data.paidMemberIds) ? data.paidMemberIds : [] };
    });
    monthPaymentsByMonth = nextMap;
    renderVcDetails();
  });
}

function setVcTab(tabName) {
  selectedVcTab = tabName;
  const baseBtn = "w-1/3 rounded-lg px-3 py-2 text-sm font-semibold";
  vcTabOverviewBtn.className = tabName === "overview" ? `${baseBtn} bg-white text-slate-800 shadow border border-slate-200` : `${baseBtn} bg-slate-50 text-slate-600`;
  vcTabPaymentsBtn.className = tabName === "payments" ? `${baseBtn} bg-white text-slate-800 shadow border border-slate-200` : `${baseBtn} bg-slate-50 text-slate-600`;
  vcTabScheduleBtn.className = tabName === "schedule" ? `${baseBtn} bg-white text-slate-800 shadow border border-slate-200` : `${baseBtn} bg-slate-50 text-slate-600`;

  vcTabOverviewEl.classList.toggle("hidden", tabName !== "overview");
  vcTabPaymentsEl.classList.toggle("hidden", tabName !== "payments");
  vcTabScheduleEl.classList.toggle("hidden", tabName !== "schedule");

  renderVcDetails();
}

function renderVcDetails() {
  const committee = committees.find((c) => c.id === selectedCommitteeId);
  if (!committee) return;

  if (selectedVcTab === "overview") {
    renderVcOverview(committee);
  } else if (selectedVcTab === "payments") {
    renderVcPayments(committee);
  } else {
    renderVcSchedule(committee);
  }
}

function getPaidMemberIdsForMonth(monthNo) {
  const entry = monthPaymentsByMonth[monthNo];
  return new Set((entry && entry.paidMemberIds) || []);
}

function renderVcOverview(committee) {
  const members = Array.isArray(committee.members) ? committee.members : [];
  const totalAmount = Number(committee.totalAmount) || 0;
  const monthlyInstallment = Number(committee.monthlyInstallment) || 0;
  const totalMonths = Number(committee.totalMonths) || 0;

  vcDetailsName.textContent = committee.vcName || "VC";
  vcDetailsMeta.textContent = `${members.length} member(s) | ${formatCurrency(monthlyInstallment)} / month | Total ${totalMonths} month(s)`;

  const attachments = Array.isArray(committee.attachments) ? committee.attachments : [];
  const attachWrap = document.getElementById("vc-attachments");
  if (attachWrap) {
    attachWrap.innerHTML = "";
    if (attachments.length) {
      attachments.slice(0, 4).forEach((att) => {
        const dataUrl = att.dataUrl || att.url || "";
        if (!dataUrl) return;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "attachment-thumb rounded-xl border border-slate-200 bg-white p-1.5 hover:bg-slate-50";
        btn.innerHTML = `<img src="${dataUrl}" alt="VC Attachment" class="h-12 w-12 rounded-lg object-cover" />`;
        btn.addEventListener("click", () => openImageModal(dataUrl));
        attachWrap.appendChild(btn);
      });
    }
  }
  vcTabOverviewEl.innerHTML = `
    <div class="rounded-xl bg-white p-4 border border-slate-200">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h3 class="text-lg font-bold text-slate-900">${committee.vcName || "VC"}</h3>
          <p class="mt-1 text-sm text-slate-600">Members: ${members.length}</p>
          <p class="mt-1 text-sm text-slate-600">Total: ${formatCurrency(totalAmount)}</p>
          <p class="mt-1 text-sm text-slate-600">Installment: ${formatCurrency(monthlyInstallment)} / month</p>
        </div>
        <div class="shrink-0">
          <span class="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Total Months: ${totalMonths}</span>
        </div>
      </div>
    </div>
  `;
  lucide.createIcons();
}


function buildReminderMessage(memberName, monthlyInstallment, vcName) {
  const amountText = formatCurrency(Number(monthlyInstallment) || 0);
  return `Assalam-o-Alaikum ${memberName}, this is a reminder for your VC installment of ${amountText} for ${vcName}. Please clear it soon.`;
}

function renderVcPayments(committee) {
  const members = Array.isArray(committee.members) ? committee.members : [];
  const monthlyInstallment = Number(committee.monthlyInstallment) || 0;
  const totalMonths = Number(committee.totalMonths) || 0;

  const safeMonthNo = Math.max(1, Math.min(Number(selectedMonthNo) || 1, totalMonths || 1));
  selectedMonthNo = safeMonthNo;

  const expectedMember = members.find((m) => Number(m.turnNumber) === safeMonthNo) || null;
  vcDetailsName.textContent = committee.vcName || "VC";
  vcDetailsMeta.textContent = `Current Month: ${safeMonthNo} (highlight: Turn #${safeMonthNo})`;

  const paidSet = getPaidMemberIdsForMonth(safeMonthNo);

  vcTabPaymentsEl.innerHTML = `
    <div class="rounded-xl bg-white p-4 border border-slate-200">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <h4 class="text-sm font-bold text-slate-900">Member List & Payments</h4>
          <p class="mt-1 text-sm text-slate-600">
            Highlighted: ${expectedMember ? `${expectedMember.name} (Turn #${expectedMember.turnNumber})` : "No matching Turn member"}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-slate-600" for="vcMonthSelect">Month</label>
          <select id="vcMonthSelect" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none">
            ${Array.from({ length: Math.max(totalMonths, 1) }).map((_, idx) => {
              const m = idx + 1;
              return `<option value="${m}" ${m === safeMonthNo ? "selected" : ""}>${m}</option>`;
            }).join("")}
          </select>
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-xs text-slate-500">
              <th class="py-2 pr-2">Member</th>
              <th class="py-2 pr-2">Turn</th>
              <th class="py-2 pr-2">Status</th>
              <th class="py-2 pr-2">Mark Paid</th>
              <th class="py-2">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            ${members
              .slice()
              .sort((a, b) => Number(a.turnNumber || 0) - Number(b.turnNumber || 0))
              .map((m) => {
                const isPaid = paidSet.has(m.memberId);
                const isCurrent = Number(m.turnNumber) === safeMonthNo;
                const statusBadgeClass = isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200";
                const rowClass = isCurrent ? "bg-brand-50/70 border-brand-200" : "";
                const message = buildReminderMessage(m.name, monthlyInstallment, committee.vcName);
                const waLink = getWhatsAppLink(m.whatsapp, message);

                return `
                  <tr class="${rowClass} border-b border-slate-100">
                    <td class="py-2 pr-2">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-slate-900">${m.name || "-"}</span>
                        ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-50" title="WhatsApp Reminder">
                          <i data-lucide="message-circle" class="h-4 w-4"></i>
                        </a>` : ""}
                        ${isCurrent ? '<span class="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">Current Payout</span>' : ""}
                      </div>
                    </td>
                    <td class="py-2 pr-2 text-slate-700">${m.turnNumber || "-"}</td>
                    <td class="py-2 pr-2">
                      <span class="inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${statusBadgeClass}">
                        ${isPaid ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td class="py-2 pr-2">
                      <label class="inline-flex items-center gap-2">
                        <input type="checkbox" class="member-paid-checkbox h-4 w-4 rounded text-brand-500" data-member-id="${m.memberId}" ${isPaid ? "checked" : ""} />
                      </label>
                    </td>
                    <td class="py-2">
                      ${
                        waLink
                          ? `<a href="${waLink}" target="_blank" rel="noopener" class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50">
                               <i data-lucide="message-circle" class="h-4 w-4"></i>
                             </a>`
                          : `<span class="text-xs text-slate-500">N/A</span>`
                      }
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  lucide.createIcons();

  const monthSelect = document.getElementById("vcMonthSelect");
  if (monthSelect) monthSelect.disabled = true;
  monthSelect.addEventListener("change", (e) => {
    selectedMonthNo = Number(e.target.value) || 1;
    renderVcDetails();
  });

  vcTabPaymentsEl.querySelectorAll(".member-paid-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const memberId = event.target.getAttribute("data-member-id");
      const checked = event.target.checked;
      if (!memberId) return;
      await setMemberPaid(committee.id, safeMonthNo, memberId, checked);
    });
  });
}

async function setMemberPaid(committeeId, monthNo, memberId, shouldBePaid) {
  // Optimistic UI update
  const prevSet = getPaidMemberIdsForMonth(monthNo);
  if (shouldBePaid) prevSet.add(memberId);
  else prevSet.delete(memberId);

  const nextPaidMemberIds = Array.from(prevSet);
  monthPaymentsByMonth[monthNo] = { paidMemberIds: nextPaidMemberIds };
  // Persist to Firestore
  await setDoc(doc(db, "committees", committeeId, "monthPayments", String(monthNo)), { userId: currentUser.uid, monthNo, paidMemberIds: nextPaidMemberIds, updatedAt: new Date().toISOString() }, { merge: true });

  // Update paidMonthNumbers at committee root for fast savings calculation
  const committee = committees.find((c) => c.id === committeeId);
  const members = Array.isArray(committee?.members) ? committee.members : [];
  const expectedMember = members.find((m) => Number(m.turnNumber) === Number(monthNo)) || null;
  if (expectedMember && expectedMember.memberId) {
    const paidMonthNumbers = Array.isArray(committee?.paidMonthNumbers) ? committee.paidMonthNumbers : [];
    const paidSet = new Set(paidMonthNumbers.map((n) => Number(n)).filter((n) => Number.isFinite(n)));
    if (nextPaidMemberIds.includes(expectedMember.memberId)) paidSet.add(Number(monthNo));
    else paidSet.delete(Number(monthNo));

    const nextPaidMonthsArr = Array.from(paidSet).sort((a, b) => a - b);
    await updateDoc(doc(db, "committees", committeeId), {
      paidMonthNumbers: nextPaidMonthsArr,
      updatedAt: new Date().toISOString(),
    });
    // Optimistic local update
    committees = committees.map((c) =>
      c.id === committeeId ? { ...c, paidMonthNumbers: nextPaidMonthsArr } : c
    );
  }

  renderVcDetails();
}

function renderVcSchedule(committee) {
  const members = Array.isArray(committee.members) ? committee.members : [];
  const monthlyInstallment = Number(committee.monthlyInstallment) || 0;
  const totalMonths = Number(committee.totalMonths) || 0;
  const currentMonthNo = Math.max(1, Number(committee.currentPayoutMonth) || Number(selectedMonthNo) || 1);

  const monthCount = Math.max(totalMonths, 1);
  vcDetailsName.textContent = committee.vcName || "VC";
  vcDetailsMeta.textContent = `Schedule for ${monthCount} months`;

  vcTabScheduleEl.innerHTML = `
    <div class="rounded-xl bg-white p-4 border border-slate-200">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h4 class="text-sm font-bold text-slate-900">Payout Schedule</h4>
          <p class="mt-1 text-sm text-slate-600">Installment: ${formatCurrency(monthlyInstallment)}</p>
        </div>
        <span class="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Current Month: ${selectedMonthNo}</span>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-xs text-slate-500">
              <th class="py-2 pr-2">Month</th>
              <th class="py-2 pr-2">Expected Member (Turn)</th>
              <th class="py-2 pr-2">Status</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: monthCount }).map((_, idx) => {
              const m = idx + 1;
              const expected = members.find((mm) => Number(mm.turnNumber) === m) || null;
              const paidSet = getPaidMemberIdsForMonth(m);
              const isPaid = expected ? paidSet.has(expected.memberId) : false;
              const phase = m < currentMonthNo ? "Completed" : m === currentMonthNo ? "Current Payout" : "Upcoming";
              const paymentStatus = expected ? (isPaid ? "Paid" : "Pending") : "Unassigned";
              const phaseClass =
                m < currentMonthNo
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : m === currentMonthNo
                  ? "bg-brand-50 text-brand-700 border-brand-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";
              const rowClass = m === currentMonthNo ? "bg-brand-50/70" : "";

              return `
                <tr class="${rowClass} border-b border-slate-100">
                  <td class="py-2 pr-2 font-semibold">${m}</td>
                  <td class="py-2 pr-2">${expected ? `${expected.name} (Turn #${expected.turnNumber})` : "-"}</td>
                  <td class="py-2 pr-2">
                    <div>
                      <span class="inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${phaseClass}">
                        ${phase}
                      </span>
                      <div class="mt-1 text-xs text-slate-600">${paymentStatus}</div>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  lucide.createIcons();
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

function downloadSummaryPdf() {
  if (!window.jspdf?.jsPDF) return;
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF();
  docPdf.text("Karza Summary Report", 14, 20);
  docPdf.text(`Total Debt: ${totalBorrowedEl.textContent}`, 14, 30);
  docPdf.text(`Total Paid: ${totalPaidEl.textContent}`, 14, 38);
  docPdf.text(`Remaining: ${totalDebtEl.textContent}`, 14, 46);
  docPdf.save(`karza-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

async function migrateLocalStorageData(user) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const oldDebts = JSON.parse(raw);
    if (!Array.isArray(oldDebts) || !oldDebts.length) return localStorage.removeItem(STORAGE_KEY);
    for (const d of oldDebts) {
      await addDoc(collection(db, "debts"), {
        userId: user.uid,
        lenderName: d.lenderName || "Unknown",
        amountBorrowed: Number(d.amountBorrowed) || 0,
        dateBorrowed: d.dateBorrowed || new Date().toISOString().slice(0, 10),
        deadlineDate: d.deadlineDate || new Date().toISOString().slice(0, 10),
        interestType: d.interestType === "fixed" ? "fixed" : "none",
        interestRate: Number(d.interestRate) || 0,
        interestAfterMonths: Number(d.interestAfterMonths) || 0,
        payments: Array.isArray(d.payments) ? d.payments : [],
        createdAt: d.createdAt || new Date().toISOString(),
      });
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Migration failed", error);
  }
}

function bindFirestore(user) {
  if (unsubscribeDebts) unsubscribeDebts();
  if (unsubscribeCommittees) unsubscribeCommittees();
  unsubscribeDebts = onSnapshot(query(collection(db, "debts"), where("userId", "==", user.uid)), (snap) => {
    debts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderSummary();
    renderDebts();
  });
  unsubscribeCommittees = onSnapshot(query(collection(db, "committees"), where("userId", "==", user.uid)), (snap) => {
    committees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderCommittees();
  });
}

function setAuthMode(mode) {
  if (!loginForm || !registerForm || !showLoginBtn || !showRegisterBtn) return;
  const isLogin = mode === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  showLoginBtn.className = isLogin
    ? "w-1/2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800"
    : "w-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600";
  showRegisterBtn.className = !isLogin
    ? "w-1/2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800"
    : "w-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600";
}

async function loginUser() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error(error);
    window.alert("Google login failed.");
  }
}

async function loginWithEmail(event) {
  event.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    loginForm.reset();
  } catch (error) {
    console.error(error);
    window.alert(error.message || "Login failed.");
  }
}

async function registerWithEmail(event) {
  event.preventDefault();
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, registerEmail.value.trim(), registerPassword.value);
    await updateProfile(userCredential.user, { displayName: registerName.value.trim() });
    registerForm.reset();
  } catch (error) {
    console.error(error);
    window.alert(error.message || "Registration failed.");
  }
}

if (googleLoginBtn) googleLoginBtn.addEventListener("click", loginUser);
if (loginForm) loginForm.addEventListener("submit", loginWithEmail);
if (registerForm) registerForm.addEventListener("submit", registerWithEmail);
if (showLoginBtn) showLoginBtn.addEventListener("click", () => setAuthMode("login"));
if (showRegisterBtn) showRegisterBtn.addEventListener("click", () => setAuthMode("register"));

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });
}

debtForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;
  const data = new FormData(debtForm);
  const attachments = await readFilesAsDataUrls(debtImagesInputEl?.files);
  const side = debtSide;
  const penaltyPerDay = side === "receive" ? Number(data.get("penaltyPerDay")) || 0 : 0;
  const payload = {
    userId: currentUser.uid,
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
  // Reset to default owe mode UI
  applyDebtModeUI(debtSide);
  if (debtImagesInputEl) debtImagesInputEl.value = "";
});

function syncMemberRemoveButtons() {
  const rows = membersInputsEl.querySelectorAll(".member-row");
  rows.forEach((row, idx) => {
    const btn = row.querySelector(".remove-member-btn");
    if (!btn) return;
    const shouldDisable = rows.length <= 1;
    btn.disabled = shouldDisable;
    btn.classList.toggle("opacity-50", shouldDisable);
    btn.classList.toggle("cursor-not-allowed", shouldDisable);
  });
}

function createMemberRow() {
  const row = document.createElement("div");
  row.className = "member-row grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr,1.4fr,0.8fr,auto] sm:items-center";
  row.innerHTML = `
    <input class="member-name w-full rounded-xl border px-3 py-2.5" type="text" placeholder="Member Name" required />
    <input class="member-whatsapp w-full rounded-xl border px-3 py-2.5" type="text" placeholder="WhatsApp Number" required />
    <input class="member-turn w-full rounded-xl border px-3 py-2.5" type="number" min="1" placeholder="Turn #" required />
    <button type="button" class="remove-member-btn rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50">Remove</button>
  `;

  const removeBtn = row.querySelector(".remove-member-btn");
  removeBtn.addEventListener("click", () => {
    row.remove();
    syncMemberRemoveButtons();
  });

  return row;
}

addMemberBtn.addEventListener("click", () => {
  membersInputsEl.appendChild(createMemberRow());
  syncMemberRemoveButtons();
  lucide.createIcons();
});

syncMemberRemoveButtons();

committeeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentUser) return;

  const vcName = document.getElementById("vcName")?.value?.trim();
  const vcTotalAmount = Number(document.getElementById("vcTotalAmount")?.value) || 0;
  const monthlyInstallment = Number(document.getElementById("monthlyInstallment")?.value) || 0;
  const totalMonths = Number(document.getElementById("totalMonths")?.value) || 0;
  const currentPayoutMonth = Number(document.getElementById("currentPayoutMonth")?.value) || 1;
  const vcAttachments = await readFilesAsDataUrls(vcImagesInputEl?.files);

  if (!vcName) {
    window.alert("VC Name is required.");
    return;
  }
  if (vcTotalAmount <= 0 || monthlyInstallment <= 0 || totalMonths <= 0) {
    window.alert("Please enter valid Total Amount, Monthly Installment and Total Months.");
    return;
  }

  const rows = membersInputsEl.querySelectorAll(".member-row");
  const members = Array.from(rows).map((row) => {
    const name = row.querySelector(".member-name")?.value?.trim();
    const whatsapp = row.querySelector(".member-whatsapp")?.value?.trim();
    const turnNumber = Number(row.querySelector(".member-turn")?.value) || 0;
    return {
      memberId: crypto.randomUUID(),
      name: name || "",
      whatsapp: whatsapp || "",
      turnNumber,
    };
  });

  if (members.length < 1) {
    window.alert("Add at least one member.");
    return;
  }

  const invalid = members.find((m) => !m.name || !m.whatsapp || !Number.isFinite(m.turnNumber) || m.turnNumber <= 0);
  if (invalid) {
    window.alert("Each member needs Name, WhatsApp number and a valid Turn #.");
    return;
  }

  const turns = members.map((m) => m.turnNumber);
  const uniqueTurns = new Set(turns);
  if (uniqueTurns.size !== turns.length) {
    window.alert("Turn # values must be unique for each member.");
    return;
  }

  await addDoc(collection(db, "committees"), {
    userId: currentUser.uid,
    vcName,
    totalAmount: vcTotalAmount,
    monthlyInstallment,
    totalMonths,
    currentPayoutMonth,
    members,
    attachments: vcAttachments,
    paidMonthNumbers: [],
    createdAt: new Date().toISOString(),
  });

  // Reset form + members UI back to a single empty row.
  committeeForm.reset();
  membersInputsEl.innerHTML = "";
  membersInputsEl.appendChild(createMemberRow());
  syncMemberRemoveButtons();
  if (vcImagesInputEl) vcImagesInputEl.value = "";
});

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
privacyToggleBtn.addEventListener("click", () => document.body.classList.toggle("privacy-on"));
pdfReportBtn.addEventListener("click", downloadSummaryPdf);

vcTabOverviewBtn.addEventListener("click", () => setVcTab("overview"));
vcTabPaymentsBtn.addEventListener("click", () => setVcTab("payments"));
vcTabScheduleBtn.addEventListener("click", () => setVcTab("schedule"));

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

if (modeOweBtn) modeOweBtn.addEventListener("click", () => applyDebtModeUI("owe"));
if (modeReceiveBtn) modeReceiveBtn.addEventListener("click", () => applyDebtModeUI("receive"));

// Image modal handlers
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

applyDebtModeUI("owe");

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    authSection.classList.remove("hidden");
    appSection.classList.add("hidden");
    userInfo.textContent = "";
    debts = [];
    committees = [];
    renderDebts();
    renderCommittees();
    setAuthMode("login");
    return;
  }
  authSection.classList.add("hidden");
  appSection.classList.remove("hidden");
  userInfo.textContent = `${user.displayName || "User"} (${user.email || ""})`;
  await migrateLocalStorageData(user);
  bindFirestore(user);
  handleInterestVisibility();
  setTab("active");
  lucide.createIcons();
});
