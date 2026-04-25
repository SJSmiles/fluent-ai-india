import React, { createContext, useContext, useState, useEffect } from "react";
import { authService } from "../api/authService";
import { userService } from "../api/userService";

interface User {
  _id: string;
  userName?: string;
  name?: string;
  email: string;
  companyId: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  superAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // On every app load/refresh: validate token by calling getCurrentUser
  // If accessToken is expired, the axios interceptor auto-refreshes it using refreshToken
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('token');
      const storedRefreshToken = localStorage.getItem('refreshToken');

      if (!token && !storedRefreshToken) {
        // No session at all
        setLoading(false);
        return;
      }

      try {
        const res = await userService.getCurrentUser();
        const userData = res.data.data || res.data;
        setUser(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
      } catch (err) {
        console.error("Auth init failed:", err);
        // Both access token and refresh token failed
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('currentUser');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (credentials: any) => {
    // Step 1: Login → get accessToken + refreshToken
    const response = await authService.login(credentials);
    const token = response.data.data.accessToken;
    const refreshToken = response.data.data.refreshToken;
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }

    // Step 2: Get current user info
    const currentUserResponse = await userService.getCurrentUser();
    const userData = currentUserResponse.data.data || currentUserResponse.data;
    setUser(userData);

    // Step3: Save the user data to localStorage <--
    localStorage.setItem(
      'currentUser',
      JSON.stringify(userData),
    );
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');

      // --> NEW: Wipe the stored user data on logout <--
      localStorage.removeItem('currentUser');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
