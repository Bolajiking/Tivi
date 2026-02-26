'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { usePrivy } from '@privy-io/react-auth';
import { getAllStreams } from '@/features/streamAPI';
import type { RootState, AppDispatch } from '@/store/store';

interface StreamContextType {
  streams: any[];
  filteredStreams: any[];
  selectedStream: string;
  setSelectedStream: (streamId: string) => void;
  loading: boolean;
}

const StreamContext = createContext<StreamContextType | undefined>(undefined);

export const StreamProvider = ({ children }: { children: ReactNode }) => {
  const { user } = usePrivy();
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading } = useSelector((state: RootState) => state.streams);
  const [selectedStream, setSelectedStream] = useState<string>('');

  // Fetch streams when component mounts
  useEffect(() => {
    dispatch(getAllStreams());
  }, [dispatch]);

  // Filter streams that have playbackId
  const filteredStreams = streams.filter(
    (stream: any) => !!stream.playbackId && stream.creatorId?.value === user?.wallet?.address,
  );

  const value = {
    streams,
    filteredStreams,
    selectedStream,
    setSelectedStream,
    loading,
  };

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
};

export const useStream = () => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error('useStream must be used within a StreamProvider');
  }
  return context;
};
