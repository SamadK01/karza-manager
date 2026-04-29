// Main Application Coordinator
import { initializeAuth, currentUser } from './auth.js';
import { initializeDebtModule, renderSummary } from './debt.js';
import { initializeVcModule, renderCommittees } from './vc.js';

// Global modules
window.authModule = { currentUser };
window.debtModule = {};
window.vcModule = {};

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize authentication first
  initializeAuth();
  
  // Initialize other modules after auth is ready
  setTimeout(() => {
    initializeDebtModule();
    initializeVcModule();
  }, 100);
  
  // Global UI controls
  const privacyToggleBtn = document.getElementById("privacyToggleBtn");
  const pdfReportBtn = document.getElementById("pdfReportBtn");
  
  // Privacy toggle
  if (privacyToggleBtn) {
    privacyToggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("privacy-on");
    });
  }
  
  // PDF Report generation
  if (pdfReportBtn) {
    pdfReportBtn.addEventListener("click", () => {
      downloadSummaryPdf();
    });
  }
  
  // Image modal handlers
  const imageModalCloseBtn = document.getElementById("imageModalCloseBtn");
  const imageModalEl = document.getElementById("imageModal");
  
  if (imageModalCloseBtn) {
    imageModalCloseBtn.addEventListener("click", () => {
      const imageModalImg = document.getElementById("imageModalImg");
      imageModalImg.src = "";
      imageModalEl.classList.add("hidden");
      imageModalEl.classList.remove("flex");
    });
  }
  
  if (imageModalEl) {
    imageModalEl.addEventListener("click", (e) => {
      if (e.target === imageModalEl) {
        const imageModalImg = document.getElementById("imageModalImg");
        imageModalImg.src = "";
        imageModalEl.classList.add("hidden");
        imageModalEl.classList.remove("flex");
      }
    });
  }
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const imageModalEl = document.getElementById("imageModal");
      const imageModalImg = document.getElementById("imageModalImg");
      imageModalImg.src = "";
      imageModalEl.classList.add("hidden");
      imageModalEl.classList.remove("flex");
    }
  });
});

// PDF Report function
function downloadSummaryPdf() {
  if (!window.jspdf?.jsPDF) return;
  const { jsPDF } = window.jspdf;
  const docPdf = new jsPDF();
  const totalBorrowedEl = document.getElementById("totalBorrowed");
  const totalPaidEl = document.getElementById("totalPaid");
  const totalDebtEl = document.getElementById("totalDebt");
  
  docPdf.text("Karza Summary Report", 14, 20);
  docPdf.text(`Total Debt: ${totalBorrowedEl.textContent}`, 14, 30);
  docPdf.text(`Total Paid: ${totalPaidEl.textContent}`, 14, 38);
  docPdf.text(`VC Savings: ${totalDebtEl.textContent}`, 14, 46);
  docPdf.save(`karza-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Listen for auth state changes to update UI
window.addEventListener('authStateChanged', (event) => {
  const user = event.detail.user;
  if (user) {
    // User logged in - initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
});

// Helper function to update file input after removing previews
window.updateFileInput = function(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    const dt = new DataTransfer();
    input.files = dt.files;
  }
};

// Export for global access
window.downloadSummaryPdf = downloadSummaryPdf;
