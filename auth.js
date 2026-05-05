// Authentication Module
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

// DOM Elements
const authSection = document.getElementById("authSection");
const appSection = document.getElementById("appSection");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const rememberMe = document.getElementById("rememberMe");
const registerName = document.getElementById("registerName");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

// State
let currentUser = null;

// Functions
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
    window.utils?.showToast("Successfully logged in!", "success");
  } catch (error) {
    console.error(error);
    window.utils?.showToast("Google login failed. Please try again.", "error");
  }
}

async function loginWithEmail(event) {
  event.preventDefault();
  try {
    const persistence = rememberMe.checked ? 'local' : 'session';
    await signInWithEmailAndPassword(auth, loginEmail.value.trim(), loginPassword.value);
    
    // Store remember me preference
    if (rememberMe.checked) {
      localStorage.setItem('karza-remember-email', loginEmail.value.trim());
      localStorage.setItem('karza-remember-time', Date.now().toString());
    } else {
      localStorage.removeItem('karza-remember-email');
      localStorage.removeItem('karza-remember-time');
    }
    
    loginForm.reset();
    window.utils?.showToast("Successfully logged in!", "success");
  } catch (error) {
    console.error(error);
    window.utils?.showToast(error.message || "Login failed. Please check your credentials.", "error");
  }
}

async function registerWithEmail(event) {
  event.preventDefault();
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, registerEmail.value.trim(), registerPassword.value);
    await updateProfile(userCredential.user, { displayName: registerName.value.trim() });
    registerForm.reset();
    window.utils?.showToast("Account created successfully!", "success");
  } catch (error) {
    console.error(error);
    window.utils?.showToast(error.message || "Registration failed. Please try again.", "error");
  }
}

async function migrateLocalStorageData(user) {
  const STORAGE_KEY = "karza-debts";
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

function initializeAuth() {
  // Check for remembered email and auto-fill
  const rememberedEmail = localStorage.getItem('karza-remember-email');
  const rememberedTime = localStorage.getItem('karza-remember-time');
  
  if (rememberedEmail && rememberedTime) {
    const daysPassed = (Date.now() - parseInt(rememberedTime)) / (1000 * 60 * 60 * 24);
    if (daysPassed <= 30) {
      loginEmail.value = rememberedEmail;
      rememberMe.checked = true;
    } else {
      // Clear expired remember me data
      localStorage.removeItem('karza-remember-email');
      localStorage.removeItem('karza-remember-time');
    }
  }

  // Event Listeners
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

  // Auth State Listener
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    // Update global auth module reference
    window.authModule.currentUser = user;
    
    if (!user) {
      authSection.classList.remove("hidden");
      appSection.classList.add("hidden");
      userInfo.textContent = "";
      setAuthMode("login");
      // Trigger app reset
      window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: null } }));
      return;
    }
    authSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    userInfo.textContent = `${user.displayName || "User"} (${user.email || ""})`;
    await migrateLocalStorageData(user);
    // Trigger app initialization
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user } }));
  });
}

// Export for use in other modules
export {
  auth,
  currentUser,
  initializeAuth,
  setAuthMode,
  loginUser,
  loginWithEmail,
  registerWithEmail
};
