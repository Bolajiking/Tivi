'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface LogoProps {
  className?: string;
  href?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', href = '/', size = 'md' }: LogoProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-10',
  };

  const LogoContent = () => (
    <div className="relative inline-block group cursor-pointer">
      <Image
        src="/assets/images/tvinbio-logo.svg"
        alt="TVinBio"
        width={140}
        height={40}
        className={`${sizeClasses[size]} w-auto`}
      />
    </div>
  );

  if (isHome) {
    return (
      <div className={className}>
        <LogoContent />
      </div>
    );
  }

  return (
    <Link href={href} className={className}>
      <LogoContent />
    </Link>
  );
}
