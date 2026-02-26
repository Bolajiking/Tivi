'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ChannelContextType {
  selectedChannelId: string | null;
  setSelectedChannelId: (channelId: string | null) => void;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);
const CHANNEL_STORAGE_KEY = 'selectedChannelId';

export const ChannelProvider = ({ children }: { children: ReactNode }) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  useEffect(() => {
    const savedChannelId = localStorage.getItem(CHANNEL_STORAGE_KEY);
    if (savedChannelId) {
      setSelectedChannelId(savedChannelId);
    }
  }, []);

  const handleSetSelectedChannelId = (channelId: string | null) => {
    setSelectedChannelId(channelId);
    if (channelId) {
      localStorage.setItem(CHANNEL_STORAGE_KEY, channelId);
    } else {
      localStorage.removeItem(CHANNEL_STORAGE_KEY);
    }
  };

  return (
    <ChannelContext.Provider value={{ selectedChannelId, setSelectedChannelId: handleSetSelectedChannelId }}>
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannel = () => {
  const context = useContext(ChannelContext);
  // Return default values if not within provider (for routes outside dashboard)
  if (context === undefined) {
    return {
      selectedChannelId: null,
      setSelectedChannelId: () => {
        // No-op when not in provider
        console.warn('setSelectedChannelId called outside ChannelProvider');
      },
    };
  }
  return context;
};
