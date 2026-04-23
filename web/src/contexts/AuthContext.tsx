import React, { createContext, useContext } from 'react';

type User = { id: string; email: string; role?: string } | null;

type AuthContextValue = {
  user: User;
  token: string | null;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
};

const STUB: AuthContextValue = {
  user: null,
  token: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
};

const AuthContext = createContext<AuthContextValue>(STUB);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={STUB}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
