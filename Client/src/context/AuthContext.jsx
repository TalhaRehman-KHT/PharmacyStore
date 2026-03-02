import React, { createContext, useState, useEffect } from "react";
import { getStoredUser, setStoredUser, getCurrentUser } from "../lib/authService.js";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.id) {
      getCurrentUser(stored.id)
        .then((fresh) => {
          if (fresh) {
            setUser(fresh);
            setStoredUser(fresh);
          } else {
            setUser(null);
            setStoredUser(null);
          }
        })
        .catch(() => {
          setUser(null);
          setStoredUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    setStoredUser(userData);
  };

  const logout = () => {
    setUser(null);
    setStoredUser(null);
  };

  const updateUser = (updates) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      setStoredUser(next);
      return next;
    });
  };

  const userRole = user?.role ?? null;
  const isVendor = userRole === "vendor";
  const isUser = userRole === "user";
  const isAdmin = userRole === "admin";
  const isDoctor = userRole === "doctor";

  const hasRole = (role) => userRole === role;
  const hasAnyRole = (roles) => Array.isArray(roles) && roles.includes(userRole);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        userRole,
        isVendor,
        isUser,
        isAdmin,
        isDoctor,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
