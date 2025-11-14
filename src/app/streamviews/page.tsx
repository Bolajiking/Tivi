'use client';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAllStreams } from '@/features/streamAPI';
import StreamsShowcase from '@/components/templates/landing/StreamsShowcase';
import HorizontalNavbar from '@/components/HorizontalNavbar';
import Logo from '@/components/Logo';

export default function StreamViews() {
  const dispatch = useDispatch<AppDispatch>();
  const { streams, loading } = useSelector((state: RootState) => state.streams);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load streams for the showcase
    dispatch(getAllStreams());
    setIsLoading(false);
  }, [dispatch]);

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-black via-gray-950 to-black flex flex-col pb-20">
     <div className = "absolute top-4 left-4  ">
        <Logo size="lg" />
      </div>
      <div className="flex-1">
        <StreamsShowcase streams={streams} loading={loading} />
      </div>
      <HorizontalNavbar />
    </div>
  );
}