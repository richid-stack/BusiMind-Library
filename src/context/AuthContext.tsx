import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  telegramChatId: string | null;
  isNewUser: boolean;
  clearIsNewUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: true,
  logout: async () => {},
  telegramChatId: null,
  isNewUser: false,
  clearIsNewUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    let userDocUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userDocUnsub) {
        userDocUnsub();
        userDocUnsub = null;
      }

      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Check admin status
        const adminEmail = 'hamiltonyh727@gmail.com';
        setIsAdmin(firebaseUser.email === adminEmail);
        
        // Sync user document and subscribe in real-time to telegram link updates
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              createdAt: new Date().toISOString(),
              telegramChatId: null
            });
            setTelegramChatId(null);
            setIsNewUser(true);
          } else {
            const data = userDoc.data();
            setTelegramChatId(data.telegramChatId || null);
          }

          // Real-time listener for instant linking feedback
          userDocUnsub = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              setTelegramChatId(data.telegramChatId || null);
            }
          });
        } catch (err) {
          console.error("Error syncing user profile:", err);
        }
      } else {
        setIsAdmin(false);
        setTelegramChatId(null);
      }
      
      setLoading(false);
    });

    return () => {
      if (userDocUnsub) userDocUnsub();
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await signOut(auth);
  };

  const clearIsNewUser = () => setIsNewUser(false);

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, logout, telegramChatId, isNewUser, clearIsNewUser }}>
      {children}
    </AuthContext.Provider>
  );
};
