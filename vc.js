// VC (Committee) Management Module
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

const db = getFirestore();

// DOM Elements
const committeeForm = document.getElementById("committeeForm");
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
const vcImagesInputEl = document.getElementById("vcImagesInput");

// New VC Tab Navigation
const vcManagedByMeBtn = document.getElementById("vcManagedByMeBtn");
const vcMyInvestmentsBtn = document.getElementById("vcMyInvestmentsBtn");
const vcManagedContent = document.getElementById("vcManagedContent");
const vcInvestmentsContent = document.getElementById("vcInvestmentsContent");

// State
let committees = [];
let selectedCommitteeId = null;
let selectedVcTab = "overview";
let selectedMonthNo = 1;
let monthPaymentsUnsub = null;
let monthPaymentsByMonth = {};
let unsubscribeCommittees = null;
let currentVcView = "managed"; // "managed" or "investments"

// Utility Functions
const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(
    Number.isFinite(amount) ? amount : 0
  );

function getWhatsAppLink(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function buildReminderMessage(memberName, monthlyInstallment, vcName) {
  const amountText = formatCurrency(Number(monthlyInstallment) || 0);
  return `Assalam-o-Alaikum ${memberName}, this is a reminder for your VC installment of ${amountText} for ${vcName}. Please clear it soon.`;
}

function openImageModal(dataUrl) {
  if (!dataUrl) return;
  const imageModalEl = document.getElementById("imageModal");
  const imageModalImg = document.getElementById("imageModalImg");
  imageModalImg.src = dataUrl;
  imageModalEl.classList.remove("hidden");
  imageModalEl.classList.add("flex");
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

// Member Management Functions
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

// VC View Management
function setVcView(view) {
  currentVcView = view;
  
  // Update button styles
  if (vcManagedByMeBtn && vcMyInvestmentsBtn) {
    if (view === "managed") {
      vcManagedByMeBtn.className = "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow border border-slate-200";
      vcMyInvestmentsBtn.className = "flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600";
    } else {
      vcManagedByMeBtn.className = "flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600";
      vcMyInvestmentsBtn.className = "flex-1 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow border border-slate-200";
    }
  }

  // Show/hide content
  if (vcManagedContent && vcInvestmentsContent) {
    vcManagedContent.classList.toggle("hidden", view !== "managed");
    vcInvestmentsContent.classList.toggle("hidden", view !== "investments");
  }

  renderCommittees();
}

// VC Rendering Functions
function renderCommittees() {
  const user = window.authModule?.currentUser;
  if (!user) return;

  const userId = user.uid || user;
  
  // Filter committees by role
  const managedCommittees = committees.filter(c => c.userId === userId && c.role === 'admin');
  const investmentCommittees = committees.filter(c => 
    c.userId === userId && c.role === 'member'
  );

  const targetList = currentVcView === "managed" ? committeeList : 
    document.getElementById("vcInvestmentsList") || committeeList;

  const displayCommittees = currentVcView === "managed" ? managedCommittees : investmentCommittees;

  targetList.innerHTML = "";

  if (!displayCommittees.length) {
    targetList.innerHTML = `<div class="rounded-xl border border-dashed p-4 text-sm text-slate-500">
      ${currentVcView === "managed" ? "No VCs managed by you yet." : "No investment VCs found."}
    </div>`;
    if (currentVcView === "managed") {
      vcDetailsPanel.classList.add("hidden");
    }
    return;
  }

  // If selected VC is deleted, clear selection
  if (selectedCommitteeId && !displayCommittees.some((c) => c.id === selectedCommitteeId)) {
    selectedCommitteeId = null;
    monthPaymentsByMonth = {};
    if (monthPaymentsUnsub) monthPaymentsUnsub();
    monthPaymentsUnsub = null;
    if (currentVcView === "managed") {
      vcDetailsPanel.classList.add("hidden");
    }
  }

  // Render committee cards
  displayCommittees
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
      
      // Different content for managed vs investments
      if (currentVcView === "managed") {
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
      } else {
        // Investment view - show user's status
        const userMember = c.members?.find(m => m.whatsapp === user.email || m.whatsapp === user.phoneNumber);
        const userStatus = userMember ? "Active" : "Not Found";
        const statusColor = userMember ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
        
        card.innerHTML = `
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-slate-900">${c.vcName || "Untitled VC"}</p>
              <p class="mt-1 text-xs text-slate-600">
                ${formatCurrency(monthlyInstallment)} x ${totalMonths} months
              </p>
              <p class="mt-1 text-xs text-slate-500">Your Turn: #${userMember?.turnNumber || "N/A"}</p>
            </div>
            <div class="shrink-0">
              <span class="inline-flex items-center rounded-full ${statusColor} px-2 py-1 text-[11px] font-semibold">
                ${userStatus}
              </span>
            </div>
          </div>
        `;
      }

      card.addEventListener("click", (e) => {
        const target = e.target;
        if (target instanceof HTMLElement && target.closest("[data-action='delete']")) {
          return;
        }
        if (currentVcView === "managed") {
          selectCommittee(c.id);
        }
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (currentVcView === "managed") {
            selectCommittee(c.id);
          }
        }
      });

      if (currentVcView === "managed") {
        const deleteBtn = card.querySelector("[data-action='delete']");
        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!window.confirm("Delete this VC committee record?")) return;
          await deleteDoc(doc(db, "committees", c.id));
        });
      }

      targetList.appendChild(card);
    });

  if (window.lucide) window.lucide.createIcons();
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

  // Advanced Member Grid
  const memberGridHtml = createAdvancedMemberGrid(committee);
  
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
    <div class="mt-4 rounded-xl bg-white p-4 border border-slate-200">
      <h4 class="text-sm font-bold text-slate-900 mb-3">Member Payment Matrix</h4>
      ${memberGridHtml}
    </div>
  `;
  if (window.lucide) window.lucide.createIcons();
}

function createAdvancedMemberGrid(committee) {
  const members = Array.isArray(committee.members) ? committee.members : [];
  const totalMonths = Number(committee.totalMonths) || 0;
  const currentMonth = Number(committee.currentPayoutMonth) || 1;
  
  if (members.length === 0) return "<p class='text-slate-500'>No members added yet.</p>";

  let html = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm border-collapse">
        <thead>
          <tr class="text-xs text-slate-500 border-b">
            <th class="py-2 pr-2 border-r">Member/Turn</th>
            ${Array.from({length: Math.min(totalMonths, 12)}, (_, i) => 
              `<th class="py-1 px-1 text-center border-r ${i + 1 === currentMonth ? 'bg-brand-50' : ''}">M${i + 1}</th>`
            ).join('')}
            ${totalMonths > 12 ? `<th class="py-1 px-1 text-center">...</th>` : ''}
          </tr>
        </thead>
        <tbody>
  `;

  members
    .slice()
    .sort((a, b) => Number(a.turnNumber || 0) - Number(b.turnNumber || 0))
    .forEach(member => {
      const isCurrentPayout = Number(member.turnNumber) === currentMonth;
      html += `
        <tr class="${isCurrentPayout ? 'bg-brand-50/70' : ''} border-b">
          <td class="py-2 pr-2 border-r">
            <div class="flex flex-col">
              <span class="font-semibold text-slate-900">${member.name}</span>
              <span class="text-xs text-slate-500">Turn #${member.turnNumber}</span>
              ${isCurrentPayout ? '<span class="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 mt-1">Current Payout</span>' : ''}
            </div>
          </td>
      `;
      
      for (let month = 1; month <= Math.min(totalMonths, 12); month++) {
        const paidSet = getPaidMemberIdsForMonth(month);
        const isPaid = paidSet.has(member.memberId);
        const isExpected = Number(member.turnNumber) === month;
        const cellClass = month === currentMonth ? 'bg-brand-50' : '';
        const statusIcon = isPaid ? 
          '<i data-lucide="check-circle" class="h-4 w-4 text-emerald-600"></i>' : 
          isExpected ? 
            '<i data-lucide="clock" class="h-4 w-4 text-amber-600"></i>' : 
            '<i data-lucide="circle" class="h-4 w-4 text-slate-300"></i>';
        
        html += `<td class="py-1 px-1 text-center border-r ${cellClass}">${statusIcon}</td>`;
      }
      
      if (totalMonths > 12) {
        html += `<td class="py-1 px-1 text-center">...</td>`;
      }
      
      html += '</tr>';
    });

  html += '</tbody></table></div>';
  return html;
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

  if (window.lucide) window.lucide.createIcons();

  const monthSelect = document.getElementById("vcMonthSelect");
  if (monthSelect) {
    monthSelect.disabled = false;
    monthSelect.addEventListener("change", (e) => {
      selectedMonthNo = Number(e.target.value) || 1;
      renderVcDetails();
    });
  }

  vcTabPaymentsEl.querySelectorAll(".member-paid-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", async (event) => {
      const memberId = event.target.getAttribute("data-member-id");
      const checked = event.target.checked;
      if (!memberId) return;
      await setMemberPaid(committee.id, safeMonthNo, memberId, checked);
    });
  });
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

  if (window.lucide) window.lucide.createIcons();
}

async function setMemberPaid(committeeId, monthNo, memberId, shouldBePaid) {
  // Optimistic UI update
  const prevSet = getPaidMemberIdsForMonth(monthNo);
  if (shouldBePaid) prevSet.add(memberId);
  else prevSet.delete(memberId);

  const nextPaidMemberIds = Array.from(prevSet);
  monthPaymentsByMonth[monthNo] = { paidMemberIds: nextPaidMemberIds };
  
  // Persist to Firestore
  await setDoc(doc(db, "committees", committeeId, "monthPayments", String(monthNo)), { 
    userId: window.authModule?.currentUser?.uid, 
    monthNo, 
    paidMemberIds: nextPaidMemberIds, 
    updatedAt: new Date().toISOString() 
  }, { merge: true });

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

// Firestore Integration
function bindVcFirestore(user) {
  if (unsubscribeCommittees) unsubscribeCommittees();
  const userId = user.uid || user;
  unsubscribeCommittees = onSnapshot(query(collection(db, "committees"), where("userId", "==", userId)), (snap) => {
    committees = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    console.log("Fetched committees:", committees.length, "for user:", userId);
    renderCommittees();
  });
}

// Event Listeners
function initializeVcModule() {
  // Committee form submission
  committeeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    // Get current user from auth module
    const user = window.authModule?.currentUser || document.querySelector('[data-user-id]')?.dataset?.userId;
    if (!user) {
      console.error("No user found for VC creation");
      window.alert("Please login to create a VC.");
      return;
    }
    
    const userId = user.uid || user;
    console.log("Creating VC for user:", userId);

    const vcName = document.getElementById("vcName")?.value?.trim();
    const vcTotalAmount = Number(document.getElementById("vcTotalAmount")?.value) || 0;
    const monthlyInstallment = Number(document.getElementById("monthlyInstallment")?.value) || 0;
    const totalMonths = Number(document.getElementById("totalMonths")?.value) || 0;
    const currentPayoutMonth = Number(document.getElementById("currentPayoutMonth")?.value) || 1;
    const vcAttachments = await readFilesAsDataUrls(vcImagesInputEl?.files);
    
    // Get selected role
    const selectedRole = document.querySelector('input[name="vcRole"]:checked')?.value;
    if (!selectedRole) {
      window.alert("Please select who is managing this VC (Admin or Member).");
      return;
    }

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
      userId: userId,
      role: selectedRole,
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
    
    console.log("VC created successfully with role:", selectedRole);

    // Reset form + members UI back to a single empty row
    committeeForm.reset();
    membersInputsEl.innerHTML = "";
    membersInputsEl.appendChild(createMemberRow());
    syncMemberRemoveButtons();
    if (vcImagesInputEl) vcImagesInputEl.value = "";
  });

  // VC Tab Navigation
  if (vcManagedByMeBtn) vcManagedByMeBtn.addEventListener("click", () => setVcView("managed"));
  if (vcMyInvestmentsBtn) vcMyInvestmentsBtn.addEventListener("click", () => setVcView("investments"));

  // VC Details Tabs
  if (vcTabOverviewBtn) vcTabOverviewBtn.addEventListener("click", () => setVcTab("overview"));
  if (vcTabPaymentsBtn) vcTabPaymentsBtn.addEventListener("click", () => setVcTab("payments"));
  if (vcTabScheduleBtn) vcTabScheduleBtn.addEventListener("click", () => setVcTab("schedule"));

  // Member management
  if (addMemberBtn) {
    addMemberBtn.addEventListener("click", () => {
      membersInputsEl.appendChild(createMemberRow());
      syncMemberRemoveButtons();
      if (window.lucide) window.lucide.createIcons();
    });
  }

  syncMemberRemoveButtons();
  setVcView("managed");
}

// Listen for auth state changes
window.addEventListener('authStateChanged', (event) => {
  const user = event.detail.user;
  if (user) {
    bindVcFirestore(user);
  } else {
    committees = [];
    renderCommittees();
  }
});

// Export for use in other modules
export {
  committees,
  renderCommittees,
  initializeVcModule,
  bindVcFirestore
};
