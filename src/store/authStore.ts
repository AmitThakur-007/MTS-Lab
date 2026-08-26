import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StaffRole, normalizeRole } from '@/lib/rbac';

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  role: StaffRole | string;
  branchId?: string;
  profileImage?: string;
  phoneNumber?: string;
  department?: string;
  address?: string;
  twoFactorEnabled?: boolean;
  emailVerified?: boolean;
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
      setAuth: (user, token, refreshToken) => {
        const normalized = normalizeRole(user?.role) || 'RECEPTIONIST';
        const cleanUser = user ? { ...user, role: normalized } : null;
        set((state) => ({ 
          user: cleanUser, 
          token, 
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken 
        }));
      },
      updateUser: (partialUser) => set((state) => {
        if (!state.user) return { user: null };
        const updatedRole = partialUser.role ? (normalizeRole(partialUser.role) || state.user.role) : state.user.role;
        return { user: { ...state.user, ...partialUser, role: updatedRole } };
      }),
      setToken: (token) => set({ token }),
      setRefreshToken: (refreshToken) => set({ refreshToken }),
      logout: () => set({ user: null, token: null, refreshToken: null }),
    }),
    {
      name: 'mts-auth-storage',
    }
  )
);
