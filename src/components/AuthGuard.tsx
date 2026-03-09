'use client';
import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Spinner from './Spinner';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export default function AuthGuard({ 
  children, 
  fallback = <Spinner />, 
  redirectTo = '/dashboard' 
}: AuthGuardProps) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      router.push(redirectTo);
      return;
    }

    setIsChecking(false);
  }, [ready, authenticated, router, redirectTo]);

  // Show fallback while checking authentication
  if (!ready || isChecking) {
    return <>{fallback}</>;
  }

  // If authenticated, render children
  if (authenticated) {
    return <>{children}</>;
  }

  // This should not be reached due to redirect above, but just in case
  return null;
} 
