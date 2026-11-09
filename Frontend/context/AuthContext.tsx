'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'ADMIN' | 'TECHNICIAN' | 'VIEWER';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

interface AuthContextType {
  user: UserProfile | null;
  role: UserRole;
  isAuthenticated: boolean;
  loginAs: (role: UserRole) => void;
  logout: () => void;
}

const defaultUser: UserProfile = {
  id: 'usr-admin-01',
  email: 'admin@company.local',
  fullName: 'Senior IT Administrator',
  role: 'ADMIN',
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  role: 'ADMIN',
  isAuthenticated: true,
  loginAs: () => {},
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(defaultUser);

  useEffect(() => {
    const savedUser = localStorage.getItem('auth_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        setUser(defaultUser);
      }
    }
  }, []);

  const loginAs = (newRole: UserRole) => {
    const updatedUser: UserProfile = {
      id: `usr-${newRole.toLowerCase()}-01`,
      email: `${newRole.toLowerCase()}@company.local`,
      fullName:
        newRole === 'ADMIN'
          ? 'Senior IT Administrator'
          : newRole === 'TECHNICIAN'
          ? 'Hardware Maintenance Tech'
          : 'IT Auditor & Viewer',
      role: newRole,
    };
    setUser(updatedUser);
    localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    localStorage.setItem('auth_token', `mock_jwt_token_for_${newRole.toLowerCase()}`);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'VIEWER',
        isAuthenticated: !!user,
        loginAs,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

