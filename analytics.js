// Analytics Module for Karza Manager
import { getFirestore, collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
let analyticsSection;
let financialHealthScore;
let debtToIncomeRatio;
let monthlyTrendChart;
let paymentInsights;
let riskAssessment;

// Initialize Analytics Module
export function initializeAnalytics() {
  analyticsSection = document.getElementById("analyticsSection");
  financialHealthScore = document.getElementById("financialHealthScore");
  debtToIncomeRatio = document.getElementById("debtToIncomeRatio");
  monthlyTrendChart = document.getElementById("monthlyTrendChart");
  paymentInsights = document.getElementById("paymentInsights");
  riskAssessment = document.getElementById("riskAssessment");
  
  // Load analytics data
  loadAnalyticsData();
}

// Calculate Financial Health Score
function calculateFinancialHealthScore(debts, committees) {
  let score = 100; // Start with perfect score
  
  // Deductions based on debt situation
  const totalOwe = debts.filter(d => d.side === 'owe').reduce((sum, d) => sum + d.amountBorrowed, 0);
  const totalReceive = debts.filter(d => d.side === 'receive').reduce((sum, d) => sum + d.amountBorrowed, 0);
  
  // High debt ratio penalty
  const debtRatio = totalOwe / (totalReceive + 1);
  if (debtRatio > 2) score -= 30;
  else if (debtRatio > 1.5) score -= 20;
  else if (debtRatio > 1) score -= 10;
  
  // Overdue payments penalty
  const overdueCount = debts.filter(d => {
    if (d.side === 'receive') {
      return new Date(d.deadlineDate) < new Date() && 
             d.payments.reduce((sum, p) => sum + p.amount, 0) < d.amountBorrowed;
    }
    return false;
  }).length;
  
  score -= overdueCount * 15;
  
  // Committee participation bonus
  const activeCommittees = committees.length;
  score += Math.min(activeCommittees * 5, 20);
  
  return Math.max(0, Math.min(100, score));
}

// Calculate Debt-to-Income Ratio
function calculateDebtToIncomeRatio(debts) {
  const totalOwe = debts.filter(d => d.side === 'owe').reduce((sum, d) => sum + d.amountBorrowed, 0);
  const totalReceive = debts.filter(d => d.side === 'receive').reduce((sum, d) => sum + d.amountBorrowed, 0);
  
  if (totalReceive === 0) return totalOwe > 0 ? 100 : 0;
  return Math.round((totalOwe / totalReceive) * 100);
}

// Generate Monthly Trend Data
function generateMonthlyTrend(debts) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const currentMonth = new Date().getMonth();
  const trendData = [];
  
  for (let i = 5; i >= 0; i--) {
    const monthIndex = (currentMonth - i + 12) % 12;
    const monthName = months[monthIndex];
    
    const monthPayments = debts.reduce((total, debt) => {
      const monthPayments = debt.payments.filter(p => {
        const paymentDate = new Date(p.paidAt);
        return paymentDate.getMonth() === monthIndex;
      });
      return total + monthPayments.reduce((sum, p) => sum + p.amount, 0);
    }, 0);
    
    trendData.push({
      month: monthName,
      payments: monthPayments
    });
  }
  
  return trendData;
}

// Generate Payment Insights
function generatePaymentInsights(debts) {
  const insights = [];
  
  // Best payer
  const bestPayer = debts
    .filter(d => d.side === 'receive')
    .reduce((best, debt) => {
      const paymentRate = debt.payments.reduce((sum, p) => sum + p.amount, 0) / debt.amountBorrowed;
      return paymentRate > (best?.rate || 0) ? { name: debt.lenderName, rate: paymentRate } : best;
    }, null);
  
  if (bestPayer) {
    insights.push(`🏆 ${bestPayer.name} is your best payer (${Math.round(bestPayer.rate * 100)}% paid)`);
  }
  
  // Overdue alerts
  const overdueDebts = debts.filter(d => {
    if (d.side === 'receive') {
      return new Date(d.deadlineDate) < new Date() && 
             d.payments.reduce((sum, p) => sum + p.amount, 0) < d.amountBorrowed;
    }
    return false;
  });
  
  if (overdueDebts.length > 0) {
    insights.push(`⚠️ ${overdueDebts.length} overdue payment(s) need attention`);
  }
  
  // Monthly payment trend
  const thisMonthPayments = debts.reduce((total, debt) => {
    const currentMonth = new Date().getMonth();
    return total + debt.payments
      .filter(p => new Date(p.paidAt).getMonth() === currentMonth)
      .reduce((sum, p) => sum + p.amount, 0);
  }, 0);
  
  if (thisMonthPayments > 0) {
    insights.push(`📈 PKR ${thisMonthPayments.toLocaleString()} received this month`);
  }
  
  return insights;
}

// Risk Assessment
function assessRisk(debts, committees) {
  const risks = [];
  const totalOwe = debts.filter(d => d.side === 'owe').reduce((sum, d) => sum + d.amountBorrowed, 0);
  const totalReceive = debts.filter(d => d.side === 'receive').reduce((sum, d) => sum + d.amountBorrowed, 0);
  
  // High debt concentration risk
  if (totalOwe > totalReceive * 2) {
    risks.push({
      level: 'high',
      message: 'High debt concentration - focus on reducing outgoing debts'
    });
  }
  
  // Committee risk
  const activeCommittees = committees.filter(c => {
    const currentMonth = new Date().getMonth();
    return c.currentPayoutMonth < c.totalMonths;
  }).length;
  
  if (activeCommittees > 3) {
    risks.push({
      level: 'medium',
      message: 'Multiple active committees - ensure regular payments'
    });
  }
  
  // Payment consistency risk
  const inconsistentPayers = debts.filter(d => {
    if (d.side === 'receive') {
      const paymentRate = d.payments.reduce((sum, p) => sum + p.amount, 0) / d.amountBorrowed;
      return paymentRate < 0.5 && new Date(d.deadlineDate) < new Date();
    }
    return false;
  }).length;
  
  if (inconsistentPayers > 0) {
    risks.push({
      level: 'medium',
      message: `${inconsistentPayers} inconsistent payer(s) - follow up needed`
    });
  }
  
  return risks;
}

// Load and render analytics data
async function loadAnalyticsData() {
  try {
    const user = window.authModule?.currentUser;
    if (!user) return;
    
    const db = getFirestore();
    
    // Fetch debts
    const debtsQuery = query(collection(db, "debts"), where("userId", "==", user.uid));
    const debtsSnapshot = await getDocs(debtsQuery);
    const debts = debtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Fetch committees
    const committeesQuery = query(collection(db, "committees"), where("userId", "==", user.uid));
    const committeesSnapshot = await getDocs(committeesQuery);
    const committees = committeesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Calculate metrics
    const healthScore = calculateFinancialHealthScore(debts, committees);
    const debtRatio = calculateDebtToIncomeRatio(debts);
    const trendData = generateMonthlyTrend(debts);
    const insights = generatePaymentInsights(debts);
    const risks = assessRisk(debts, committees);
    
    // Render analytics
    renderAnalytics(healthScore, debtRatio, trendData, insights, risks);
    
  } catch (error) {
    console.error('Error loading analytics:', error);
    window.utils?.showToast('Failed to load analytics', 'error');
  }
}

// Render analytics dashboard
function renderAnalytics(healthScore, debtRatio, trendData, insights, risks) {
  if (!analyticsSection) return;
  
  // Financial Health Score
  if (financialHealthScore) {
    const scoreColor = healthScore >= 80 ? 'text-green-600' : healthScore >= 60 ? 'text-yellow-600' : 'text-red-600';
    financialHealthScore.innerHTML = `
      <div class="text-center">
        <div class="text-4xl font-bold ${scoreColor}">${healthScore}</div>
        <div class="text-sm text-slate-600">Financial Health Score</div>
        <div class="mt-2 w-full bg-slate-200 rounded-full h-2">
          <div class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full" style="width: ${healthScore}%"></div>
        </div>
      </div>
    `;
  }
  
  // Debt-to-Income Ratio
  if (debtToIncomeRatio) {
    const ratioColor = debtRatio <= 50 ? 'text-green-600' : debtRatio <= 100 ? 'text-yellow-600' : 'text-red-600';
    debtToIncomeRatio.innerHTML = `
      <div class="text-center">
        <div class="text-4xl font-bold ${ratioColor}">${debtRatio}%</div>
        <div class="text-sm text-slate-600">Debt-to-Income Ratio</div>
        <div class="text-xs text-slate-500 mt-1">
          ${debtRatio <= 50 ? 'Healthy' : debtRatio <= 100 ? 'Moderate' : 'High Risk'}
        </div>
      </div>
    `;
  }
  
  // Monthly Trend Chart
  if (monthlyTrendChart) {
    const maxPayment = Math.max(...trendData.map(d => d.payments), 1);
    monthlyTrendChart.innerHTML = `
      <div class="space-y-2">
        <h3 class="text-lg font-semibold">6-Month Payment Trend</h3>
        <div class="space-y-1">
          ${trendData.map(data => `
            <div class="flex items-center gap-2">
              <div class="w-12 text-xs text-slate-600">${data.month}</div>
              <div class="flex-1 bg-slate-200 rounded-full h-4">
                <div class="bg-brand-500 h-4 rounded-full transition-all duration-500" 
                     style="width: ${(data.payments / maxPayment) * 100}%"></div>
              </div>
              <div class="w-20 text-xs text-right">PKR ${data.payments.toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Payment Insights
  if (paymentInsights) {
    paymentInsights.innerHTML = `
      <div class="space-y-2">
        <h3 class="text-lg font-semibold">Payment Insights</h3>
        <div class="space-y-1">
          ${insights.map(insight => `
            <div class="text-sm text-slate-700 bg-slate-50 rounded-lg p-2">${insight}</div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Risk Assessment
  if (riskAssessment) {
    riskAssessment.innerHTML = `
      <div class="space-y-2">
        <h3 class="text-lg font-semibold">Risk Assessment</h3>
        <div class="space-y-1">
          ${risks.length > 0 ? risks.map(risk => `
            <div class="text-sm p-2 rounded-lg ${
              risk.level === 'high' ? 'bg-red-50 text-red-700 border border-red-200' :
              risk.level === 'medium' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
              'bg-green-50 text-green-700 border border-green-200'
            }">
              <span class="font-medium">${
                risk.level === 'high' ? '🔴' : risk.level === 'medium' ? '🟡' : '🟢'
              }</span> ${risk.message}
            </div>
          `).join('') : '<div class="text-sm text-green-700 bg-green-50 rounded-lg p-2">✅ No significant risks detected</div>'}
        </div>
      </div>
    `;
  }
}

// Export functions
export { loadAnalyticsData };
