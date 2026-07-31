import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  address: string | null;
  isConnected: boolean;
  setAddress: (address: string | null) => void;
  disconnect: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      address: null,
      isConnected: false,
      setAddress: (address) => set({ address, isConnected: !!address }),
      disconnect: () => set({ address: null, isConnected: false }),
    }),
    { name: 'xiom-user' }
  )
);

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
