// Smart Notifications System for Karza Manager
import { getFirestore, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Notification Types
const NOTIFICATION_TYPES = {
  PAYMENT_DUE: 'payment_due',
  PAYMENT_OVERDUE: 'payment_overdue',
  COMMITTEE_PAYMENT: 'committee_payment',
  PAYMENT_RECEIVED: 'payment_received',
  RISK_ALERT: 'risk_alert',
  MONTHLY_SUMMARY: 'monthly_summary'
};

// DOM Elements
let notificationPanel;
let notificationBadge;
let notificationList;
let notificationSettings;

// Notification Settings
let notificationSettingsData = {
  paymentDue: true,
  paymentOverdue: true,
  committeePayment: true,
  paymentReceived: true,
  riskAlert: true,
  monthlySummary: true,
  emailNotifications: false,
  whatsappNotifications: true,
  browserNotifications: true
};

// Initialize Notifications Module
export function initializeNotifications() {
  notificationPanel = document.getElementById("notificationPanel");
  notificationBadge = document.getElementById("notificationBadge");
  notificationList = document.getElementById("notificationList");
  notificationSettings = document.getElementById("notificationSettings");
  
  // Load notification settings
  loadNotificationSettings();
  
  // Request notification permission
  requestNotificationPermission();
  
  // Start notification scheduler
  startNotificationScheduler();
  
  // Load existing notifications
  loadNotifications();
  
  // Add immediate welcome notification
  setTimeout(() => {
    createNotification(
      NOTIFICATION_TYPES.PAYMENT_RECEIVED,
      'Welcome to Smart Notifications! 🔔',
      'You will now receive payment reminders, overdue alerts, and monthly summaries automatically.',
      { welcome: true }
    );
  }, 1000);
}

// Request Browser Notification Permission
async function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        window.utils?.showToast('Browser notifications enabled!', 'success');
      }
    } catch (error) {
      console.log('Notification permission denied');
    }
  }
}

// Load Notification Settings
function loadNotificationSettings() {
  const saved = localStorage.getItem('karza-notification-settings');
  if (saved) {
    notificationSettingsData = { ...notificationSettingsData, ...JSON.parse(saved) };
  }
}

// Save Notification Settings
function saveNotificationSettings() {
  localStorage.setItem('karza-notification-settings', JSON.stringify(notificationSettingsData));
}

// Create Notification
function createNotification(type, title, message, data = {}) {
  const notification = {
    id: Date.now().toString(),
    type,
    title,
    message,
    data,
    timestamp: new Date().toISOString(),
    read: false
  };
  
  // Save to local storage
  saveNotification(notification);
  
  // Show browser notification
  if (notificationSettingsData.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
    showBrowserNotification(notification);
  }
  
  // Show in-app notification
  showInAppNotification(notification);
  
  // Update UI
  updateNotificationBadge();
  renderNotifications();
  
  return notification;
}

// Save Notification to Local Storage
function saveNotification(notification) {
  const notifications = getStoredNotifications();
  notifications.unshift(notification);
  
  // Keep only last 50 notifications
  if (notifications.length > 50) {
    notifications.splice(50);
  }
  
  localStorage.setItem('karza-notifications', JSON.stringify(notifications));
}

// Get Stored Notifications
function getStoredNotifications() {
  const stored = localStorage.getItem('karza-notifications');
  return stored ? JSON.parse(stored) : [];
}

// Show Browser Notification
function showBrowserNotification(notification) {
  const notificationObj = new Notification(notification.title, {
    body: notification.message,
    icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%231d9bf0"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dy=".3em"%3E💰%3C/text%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%231d9bf0"/%3E%3Ctext x="50" y="50" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dy=".3em"%3E💰%3C/text%3E%3C/svg%3E',
    tag: notification.id,
    requireInteraction: notification.type === NOTIFICATION_TYPES.PAYMENT_OVERDUE
  });
  
  notificationObj.onclick = () => {
    window.focus();
    notificationObj.close();
  };
  
  // Auto close after 5 seconds (except overdue)
  if (notification.type !== NOTIFICATION_TYPES.PAYMENT_OVERDUE) {
    setTimeout(() => notificationObj.close(), 5000);
  }
}

// Show In-App Notification
function showInAppNotification(notification) {
  console.log('Showing notification:', notification);
  window.utils?.showToast(notification.message, getNotificationTypeColor(notification.type));
}

// Get Notification Type Color
function getNotificationTypeColor(type) {
  const colors = {
    [NOTIFICATION_TYPES.PAYMENT_DUE]: 'warning',
    [NOTIFICATION_TYPES.PAYMENT_OVERDUE]: 'error',
    [NOTIFICATION_TYPES.COMMITTEE_PAYMENT]: 'info',
    [NOTIFICATION_TYPES.PAYMENT_RECEIVED]: 'success',
    [NOTIFICATION_TYPES.RISK_ALERT]: 'error',
    [NOTIFICATION_TYPES.MONTHLY_SUMMARY]: 'info'
  };
  return colors[type] || 'info';
}

// Check Payment Due Notifications
async function checkPaymentDueNotifications() {
  if (!notificationSettingsData.paymentDue) return;
  
  try {
    const user = window.authModule?.currentUser;
    if (!user) return;
    
    const db = getFirestore();
    const debtsQuery = query(collection(db, "debts"), where("userId", "==", user.uid));
    const debtsSnapshot = await getDocs(debtsQuery);
    const debts = debtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    debts.forEach(debt => {
      if (debt.side === 'receive') {
        const deadlineDate = new Date(debt.deadlineDate);
        const totalPaid = debt.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
        const remaining = debt.amountBorrowed - totalPaid;
        
        if (remaining > 0) {
          // Check if due tomorrow
          if (deadlineDate.toDateString() === tomorrow.toDateString()) {
            createNotification(
              NOTIFICATION_TYPES.PAYMENT_DUE,
              `Payment Due Tomorrow`,
              `PKR ${remaining.toLocaleString()} payment due from ${debt.lenderName} tomorrow`,
              { debtId: debt.id, amount: remaining }
            );
          }
          
          // Check if overdue
          if (deadlineDate < today) {
            const daysOverdue = Math.floor((today - deadlineDate) / (1000 * 60 * 60 * 24));
            createNotification(
              NOTIFICATION_TYPES.PAYMENT_OVERDUE,
              `Payment Overdue!`,
              `PKR ${remaining.toLocaleString()} payment from ${debt.lenderName} is ${daysOverdue} days overdue`,
              { debtId: debt.id, amount: remaining, daysOverdue }
            );
          }
        }
      }
    });
    
  } catch (error) {
    console.error('Error checking payment due notifications:', error);
  }
}

// Check Committee Payment Notifications
async function checkCommitteePaymentNotifications() {
  if (!notificationSettingsData.committeePayment) return;
  
  try {
    const user = window.authModule?.currentUser;
    if (!user) return;
    
    const db = getFirestore();
    const committeesQuery = query(collection(db, "committees"), where("userId", "==", user.uid));
    const committeesSnapshot = await getDocs(committeesQuery);
    const committees = committeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    committees.forEach(committee => {
      const nextPaymentMonth = committee.currentPayoutMonth + 1;
      if (nextPaymentMonth <= committee.totalMonths) {
        // Check if payment is due this month
        const isCurrentMonthPayment = true; // Simplified logic
        if (isCurrentMonthPayment) {
          createNotification(
            NOTIFICATION_TYPES.COMMITTEE_PAYMENT,
            `Committee Payment Due`,
            `PKR ${committee.monthlyInstallment.toLocaleString()} payment due for ${committee.vcName}`,
            { committeeId: committee.id, amount: committee.monthlyInstallment }
          );
        }
      }
    });
    
  } catch (error) {
    console.error('Error checking committee notifications:', error);
  }
}

// Generate Monthly Summary
async function generateMonthlySummary() {
  if (!notificationSettingsData.monthlySummary) return;
  
  try {
    const user = window.authModule?.currentUser;
    if (!user) return;
    
    const db = getFirestore();
    const debtsQuery = query(collection(db, "debts"), where("userId", "==", user.uid));
    const debtsSnapshot = await getDocs(debtsQuery);
    const debts = debtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthlyPayments = debts.reduce((total, debt) => {
      const monthPayments = debt.payments?.filter(p => {
        const paymentDate = new Date(p.paidAt);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      }) || [];
      return total + monthPayments.reduce((sum, p) => sum + p.amount, 0);
    }, 0);
    
    const totalOwe = debts.filter(d => d.side === 'owe').reduce((sum, d) => sum + d.amountBorrowed, 0);
    const totalReceive = debts.filter(d => d.side === 'receive').reduce((sum, d) => sum + d.amountBorrowed, 0);
    
    createNotification(
      NOTIFICATION_TYPES.MONTHLY_SUMMARY,
      `Monthly Summary - ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      `Received PKR ${monthlyPayments.toLocaleString()} this month. Total: Owe PKR ${totalOwe.toLocaleString()}, Receive PKR ${totalReceive.toLocaleString()}`,
      { monthlyPayments, totalOwe, totalReceive }
    );
    
  } catch (error) {
    console.error('Error generating monthly summary:', error);
  }
}

// Start Notification Scheduler
function startNotificationScheduler() {
  // Check payment due notifications every 5 minutes for testing
  setInterval(checkPaymentDueNotifications, 5 * 60 * 1000);
  
  // Check committee payments every 5 minutes for testing
  setInterval(checkCommitteePaymentNotifications, 5 * 60 * 1000);
  
  // Generate monthly summary every 10 minutes for testing
  setInterval(generateMonthlySummary, 10 * 60 * 1000);
  
  // Run initial checks immediately
  setTimeout(() => {
    checkPaymentDueNotifications();
    checkCommitteePaymentNotifications();
    generateMonthlySummary();
    
    // Add a test notification
    createNotification(
      NOTIFICATION_TYPES.PAYMENT_DUE,
      'Notifications Active!',
      'Smart notifications system is now working. You will receive payment reminders and alerts.',
      { test: true }
    );
  }, 2000); // Wait 2 seconds for auth to complete
}

// Load and Render Notifications
function loadNotifications() {
  renderNotifications();
  updateNotificationBadge();
}

// Render Notifications
function renderNotifications() {
  if (!notificationList) return;
  
  const notifications = getStoredNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  
  if (notifications.length === 0) {
    notificationList.innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <div class="text-4xl mb-2">🔔</div>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }
  
  notificationList.innerHTML = notifications.map(notification => `
    <div class="notification-item p-4 border-b border-slate-200 hover:bg-slate-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}" 
         onclick="markNotificationRead('${notification.id}')">
      <div class="flex items-start gap-3">
        <div class="text-2xl">${getNotificationIcon(notification.type)}</div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <h4 class="font-semibold text-sm">${notification.title}</h4>
            <span class="text-xs text-slate-500">${formatNotificationTime(notification.timestamp)}</span>
          </div>
          <p class="text-sm text-slate-600 mt-1">${notification.message}</p>
          ${!notification.read ? '<span class="inline-block w-2 h-2 bg-blue-500 rounded-full mt-2"></span>' : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// Get Notification Icon
function getNotificationIcon(type) {
  const icons = {
    [NOTIFICATION_TYPES.PAYMENT_DUE]: '⏰',
    [NOTIFICATION_TYPES.PAYMENT_OVERDUE]: '⚠️',
    [NOTIFICATION_TYPES.COMMITTEE_PAYMENT]: '👥',
    [NOTIFICATION_TYPES.PAYMENT_RECEIVED]: '✅',
    [NOTIFICATION_TYPES.RISK_ALERT]: '🚨',
    [NOTIFICATION_TYPES.MONTHLY_SUMMARY]: '📊'
  };
  return icons[type] || '🔔';
}

// Format Notification Time
function formatNotificationTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  return 'Just now';
}

// Mark Notification as Read
window.markNotificationRead = function(notificationId) {
  const notifications = getStoredNotifications();
  const notification = notifications.find(n => n.id === notificationId);
  if (notification) {
    notification.read = true;
    localStorage.setItem('karza-notifications', JSON.stringify(notifications));
    renderNotifications();
    updateNotificationBadge();
  }
};

// Update Notification Badge
function updateNotificationBadge() {
  if (!notificationBadge) return;
  
  const notifications = getStoredNotifications();
  const unreadCount = notifications.filter(n => !n.read).length;
  
  if (unreadCount > 0) {
    notificationBadge.textContent = unreadCount;
    notificationBadge.classList.remove('hidden');
  } else {
    notificationBadge.classList.add('hidden');
  }
}

// Clear All Notifications
window.clearAllNotifications = function() {
  localStorage.removeItem('karza-notifications');
  renderNotifications();
  updateNotificationBadge();
  window.utils?.showToast('All notifications cleared', 'success');
};

// Export functions
export { 
  createNotification, 
  checkPaymentDueNotifications, 
  checkCommitteePaymentNotifications,
  generateMonthlySummary 
};
