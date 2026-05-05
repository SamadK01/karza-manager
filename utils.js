// Utility Functions for Karza Manager

// Toast notification system
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transform transition-all duration-300 translate-x-full`;
  
  const colors = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    warning: 'bg-yellow-500 text-white',
    info: 'bg-blue-500 text-white'
  };
  
  toast.classList.add(...colors[type].split(' '));
  toast.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium">${message}</span>
      <button onclick="this.parentElement.parentElement.remove()" class="ml-2 text-white/80 hover:text-white">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
  `;
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
    toast.classList.add('translate-x-0');
  }, 100);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove('translate-x-0');
    toast.classList.add('translate-x-full');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Loading spinner component
function showLoadingSpinner(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const spinner = document.createElement('div');
  spinner.className = 'flex items-center justify-center py-8';
  spinner.innerHTML = `
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
    <span class="ml-2 text-slate-600">Loading...</span>
  `;
  
  container.innerHTML = '';
  container.appendChild(spinner);
}

// Skeleton loader for cards
function createSkeletonCard() {
  return `
    <div class="bg-white rounded-xl p-6 shadow-sm animate-pulse">
      <div class="h-4 bg-slate-200 rounded w-3/4 mb-3"></div>
      <div class="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
      <div class="h-3 bg-slate-200 rounded w-2/3"></div>
    </div>
  `;
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Calculate days until deadline
function daysUntilDeadline(deadlineDate) {
  const deadline = new Date(deadlineDate);
  const today = new Date();
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Export functions
window.utils = {
  showToast,
  showLoadingSpinner,
  createSkeletonCard,
  formatCurrency,
  formatDate,
  daysUntilDeadline
};
