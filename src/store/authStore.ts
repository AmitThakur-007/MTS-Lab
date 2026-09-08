import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'LEAD_TECHNICIAN' | 'TECHNICIAN' | 'TECHNICAL_ASSISTANT' | 'RECEPTIONIST' | 'INVENTORY_MANAGER' | 'ACCOUNTANT' | 'CUSTOMER' | string;
  branchId?: string;
  profileImage?: string;
  phoneNumber?: string;
  department?: string;
  address?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: User, token: string, refreshToken?: string | null) => void;
  updateUser: (user: Partial<User>) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      setAuth: (user, token, refreshToken) => set((state) => ({ 
        user, 
        token, 
        refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken 
      })),
      updateUser: (partialUser) => set((state) => ({ 
        user: state.user ? { ...state.user, ...partialUser } : null 
      })),
      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      logout: () => set({ user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'mts-auth-storage',
    }
  )
);
