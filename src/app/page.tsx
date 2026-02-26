'use client';
import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/store/store';
import { getAllStreams } from '@/features/streamAPI';
import Hero from '@/components/templates/landing/Hero';
import Spinner from '@/components/Spinner';
import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { ready, authenticated } = usePrivy();
  const { streams, loading } = useSelector((state: RootState) => state.streams);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load streams for the showcase (no authentication required)
    dispatch(getAllStreams());
    setIsLoading(false);
  }, [ready, dispatch]);

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-black via-gray-950 to-black flex flex-col md:pb-2 pb-20">
      <Hero />
      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 w-full">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-6xl mx-auto gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Image
              src="/assets/images/tvinbio-logo.svg"
              alt="TVinBio"
              width={100}
              height={30}
              style={{ width: 'auto', height: 'auto' }}
              className="h-6 w-auto opacity-70"
            />
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/streamviews" className="hover:text-white transition-colors">
              Explore
            </Link>
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="https://twitter.com/tvinbio" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              Twitter
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-gray-600 text-xs">
            © 2025 TVinBio. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
