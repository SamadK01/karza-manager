# Karza Manager

A comprehensive debt and committee (VC) management system built with modern web technologies.

## 🚀 Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, TailwindCSS
- **Backend**: Firebase (Firestore Database, Authentication)
- **UI Components**: Lucide Icons
- **PDF Generation**: jsPDF
- **Deployment**: Vercel Ready

## ✨ Features

### Debt Management
- **Dual Mode**: Track both "I Owe" and "People Owe Me" debts
- **Interest Calculation**: Fixed interest with customizable rates and periods
- **Penalty System**: Daily penalties for overdue receivables
- **Payment Tracking**: Complete payment history with progress visualization
- **Document Management**: Upload receipts and attachments (NIC, agreements)
- **WhatsApp Integration**: Direct payment reminders via WhatsApp
- **Smart Insights**: Monthly payment comparisons and analytics

### Committee (VC) Management
- **Multi-Tab System**: 
  - "Managed by Me" - Admin view for created committees
  - "My Investments" - Member view for joined committees
- **Advanced Member Grid**: Member-wise payment tracking across months
- **Turn Sequence Logic**: Automated payout scheduling and highlighting
- **Payment Status**: Real-time payment tracking for each member
- **WhatsApp Reminders**: Bulk and individual member reminders

### User Experience
- **Secure Authentication**: Google Sign-In + Email/Password
- **Privacy Mode**: Blur sensitive financial data
- **Responsive Design**: Mobile-first, works on all devices
- **PDF Reports**: Download receipts and summary reports
- **Real-time Sync**: Live updates across devices
- **Search & Filter**: Advanced filtering for debts and committees

## 📁 File Structure

```
Karza Calculator/
├── index.html          # Main HTML structure
├── app.js              # Main application logic (to be modularized)
├── auth.js             # Authentication logic
├── debt.js             # Debt management functions
├── vc.js               # Committee (VC) management
├── README.md           # Project documentation
└── assets/             # Images and static files
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js (for local development)
- Firebase project setup

### Local Development
```bash
# Clone the repository
git clone <repository-url>

# Navigate to project directory
cd "Karza Calculator"

# Start local server
python3 -m http.server 8000

# Open in browser
http://localhost:8000
```

### Firebase Configuration
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password + Google providers)
3. Set up Firestore Database
4. Update Firebase configuration in `app.js`

### Deployment (Vercel)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 🔐 Security Features

- **User Isolation**: All data filtered by `userId`
- **Firebase Security Rules**: Server-side data protection
- **Input Validation**: Client-side and server-side validation
- **Privacy Controls**: Built-in privacy mode for sensitive data

## 📊 Data Models

### Debt Structure
```javascript
{
  userId: string,
  side: "owe" | "receive",
  lenderName: string,
  amountBorrowed: number,
  dateBorrowed: string,
  deadlineDate: string,
  interestType: "none" | "fixed",
  interestRate: number,
  interestAfterMonths: number,
  payments: Array<{id, amount, paidAt}>,
  attachments: Array<{id, name, dataUrl}>,
  createdAt: string
}
```

### Committee Structure
```javascript
{
  userId: string,
  vcName: string,
  totalAmount: number,
  monthlyInstallment: number,
  totalMonths: number,
  currentPayoutMonth: number,
  members: Array<{memberId, name, whatsapp, turnNumber}>,
  paidMonthNumbers: Array<number>,
  attachments: Array<{id, name, dataUrl}>,
  createdAt: string
}
```

## 🎯 Usage Guide

### Adding Debts
1. Choose mode: "I Owe" or "People Owe Me"
2. Fill in lender/borrower details
3. Set amount, dates, and interest (optional)
4. Upload supporting documents
5. Save and track payments

### Managing Committees
1. **Create VC**: Add committee details and members
2. **Track Payments**: Mark monthly payments per member
3. **Send Reminders**: Use WhatsApp integration
4. **View Schedule**: Check upcoming payout turns

### Investment Tracking
1. View committees you've joined
2. Track your payment status
3. Monitor upcoming turns
4. Download payment receipts

## 🔄 API Endpoints

### Firebase Collections
- `debts` - User debt records
- `committees` - Committee management data
- `committees/{id}/monthPayments` - Monthly payment tracking

## 🐛 Troubleshooting

### Common Issues
- **Login not working**: Check Firebase configuration
- **Data not syncing**: Verify Firestore rules
- **WhatsApp not opening**: Ensure phone numbers are properly formatted
- **PDF not generating**: Check jsPDF library loading

### Console Errors
- `getWhatsAppLink duplicate`: Fixed by removing duplicate function
- `Firebase not defined`: Check Firebase script loading
- `Permission denied`: Verify Firestore security rules

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes and test
4. Submit pull request

## 📄 License

This project is licensed under the MIT License.

## 📞 Support

For support and queries, please open an issue in the repository.

---

**Karza Manager** - Simplifying debt and committee management for everyone.
