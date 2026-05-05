// Main Application Coordinator
import { initializeAuth, currentUser } from './auth.js';
import { initializeDebtModule, renderSummary } from './debt.js';
import { initializeVcModule, renderCommittees } from './vc.js';
import { initializeAnalytics, loadAnalyticsData } from './analytics.js';
import { initializeNotifications } from './notifications.js';

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
    initializeAnalytics();
    // Initialize notifications with extra delay to ensure auth is ready
    setTimeout(initializeNotifications, 1000);
  }, 100);
  
  // Global UI controls
  const notificationBtn = document.getElementById("notificationBtn");
  const analyticsToggleBtn = document.getElementById("analyticsToggleBtn");
  const darkModeToggleBtn = document.getElementById("darkModeToggleBtn");
  const privacyToggleBtn = document.getElementById("privacyToggleBtn");
  const pdfReportBtn = document.getElementById("pdfReportBtn");
  
  // Notification panel toggle
  if (notificationBtn) {
    notificationBtn.addEventListener("click", () => {
      const notificationPanel = document.getElementById("notificationPanel");
      notificationPanel.classList.toggle("hidden");
    });
  }
  
  // Close notification panel when clicking outside
  document.addEventListener("click", (e) => {
    const notificationPanel = document.getElementById("notificationPanel");
    const notificationBtn = document.getElementById("notificationBtn");
    
    if (!notificationPanel?.contains(e.target) && !notificationBtn?.contains(e.target)) {
      notificationPanel?.classList.add("hidden");
    }
  });
  
  // Analytics toggle
  if (analyticsToggleBtn) {
    analyticsToggleBtn.addEventListener("click", () => {
      const analyticsSection = document.getElementById("analyticsSection");
      const isVisible = !analyticsSection.classList.contains("hidden");
      
      if (isVisible) {
        analyticsSection.classList.add("hidden");
        analyticsToggleBtn.innerHTML = "📊 Analytics";
      } else {
        analyticsSection.classList.remove("hidden");
        analyticsToggleBtn.innerHTML = "📊 Hide Analytics";
        loadAnalyticsData(); // Refresh data when showing
      }
      
      window.utils?.showToast(
        isVisible ? 'Analytics hidden' : 'Analytics dashboard opened', 
        'info'
      );
    });
  }
  
  // Dark mode toggle
  if (darkModeToggleBtn) {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('karza-theme') || 'light';
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      darkModeToggleBtn.innerHTML = '☀️ Light Mode';
    }
    
    darkModeToggleBtn.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('karza-theme', isDark ? 'dark' : 'light');
      darkModeToggleBtn.innerHTML = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
      
      window.utils?.showToast(
        isDark ? 'Dark mode enabled' : 'Light mode enabled', 
        'info'
      );
    });
  }
  
  // Privacy toggle
  if (privacyToggleBtn) {
    privacyToggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("privacy-on");
      const isPrivacyOn = document.body.classList.contains("privacy-on");
      window.utils?.showToast(
        isPrivacyOn ? 'Privacy mode enabled' : 'Privacy mode disabled', 
        'info'
      );
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

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Listen for auth state changes to update UI
window.addEventListener('authStateChanged', (event) => {
  const user = event.detail.user;
  if (user) {
    // User logged in - initialize lucide icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
    
    // Show PWA install prompt if available
    showInstallPrompt();
  }
});

// PWA Install Prompt
let deferredPrompt;
let installButton;

function showInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    // Create install button if it doesn't exist
    if (!document.getElementById('installAppBtn')) {
      installButton = document.createElement('button');
      installButton.id = 'installAppBtn';
      installButton.className = 'rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold';
      installButton.innerHTML = '📱 Install App';
      
      const buttonContainer = document.querySelector('.flex.flex-wrap.gap-3');
      if (buttonContainer) {
        buttonContainer.appendChild(installButton);
      }
      
      installButton.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          console.log(`User response to the install prompt: ${outcome}`);
          deferredPrompt = null;
          installButton.remove();
        }
      });
    }
  });
}

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
