import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCv-zuPIyJEgasTpaD6JjV0-00tbLP5Up8",
  authDomain: "broadcastapp-95516.firebaseapp.com",
  projectId: "broadcastapp-95516",
  storageBucket: "broadcastapp-95516.firebasestorage.app",
  messagingSenderId: "515961788042",
  appId: "1:515961788042:web:b106d2d2b5e3a7e6d9bf73"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;