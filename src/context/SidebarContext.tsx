import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/authStore';

export interface SidebarContextType {
  isCollapsed: boolean;
  isSidebarOpen: boolean;
  toggleSidebarCollapse: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  setIsCollapsed: (collapsed: boolean) => void;
  sidebarWidth: number; // in pixels: 80 when collapsed, 288 when expanded
}

const defaultContext: SidebarContextType = {
  isCollapsed: false,
  isSidebarOpen: false,
  toggleSidebarCollapse: () => {},
  setIsSidebarOpen: () => {},
  setIsCollapsed: () => {},
  sidebarWidth: 288,
};

export const SidebarContext = createContext<SidebarContextType>(defaultContext);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Persistent Collapsible Sidebar for Desktop (scoped to user account)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const storageKey = `mtslab-sidebar-collapsed:${user?.id || 'default'}`;
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  // Restore user-specific preference when user changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storageKey = `mtslab-sidebar-collapsed:${user?.id || 'default'}`;
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch {}
  }, [user?.id]);

  const toggleSidebarCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        const storageKey = `mtslab-sidebar-collapsed:${user?.id || 'default'}`;
        localStorage.setItem(storageKey, String(next));
      } catch (_) {}
      return next;
    });
  }, [user?.id]);

  const setCollapsedWithStorage = useCallback((value: boolean) => {
    setIsCollapsed(value);
    try {
      const storageKey = `mtslab-sidebar-collapsed:${user?.id || 'default'}`;
      localStorage.setItem(storageKey, String(value));
    } catch (_) {}
  }, [user?.id]);

  const sidebarWidth = isCollapsed ? 80 : 288;

  const value = useMemo<SidebarContextType>(() => ({
    isCollapsed,
    isSidebarOpen,
    toggleSidebarCollapse,
    setIsSidebarOpen,
    setIsCollapsed: setCollapsedWithStorage,
    sidebarWidth,
  }), [isCollapsed, isSidebarOpen, toggleSidebarCollapse, setCollapsedWithStorage, sidebarWidth]);

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useDashboardSidebar(): SidebarContextType {
  return useContext(SidebarContext);
}
