'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ChannelContextType {
  selectedChannelId: string | null;
  setSelectedChannelId: (channelId: string | null) => void;
}

const ChannelContext = createContext<ChannelContextType | undefined>(undefined);

export const ChannelProvider = ({ children }: { children: ReactNode }) => {
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  return (
    <ChannelContext.Provider value={{ selectedChannelId, setSelectedChannelId }}>
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

