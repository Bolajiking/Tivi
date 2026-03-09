'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface LogoProps {
  className?: string;
  href?: string;
  size?: 'sm' | 'md' | 'lg';
  iconOnly?: boolean;
}

export default function Logo({ className = '', href = '/', size = 'md', iconOnly = false }: LogoProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  const sizeClasses = {
    sm: 'h-5',
    md: 'h-8',
    lg: 'h-10',
  };

  const iconSizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const LogoContent = () => (
    <div className="relative inline-block group cursor-pointer">
      {iconOnly ? (
        <Image
          src="/assets/images/icon.png"
          alt="TVinBio"
          width={48}
          height={48}
          className={`${iconSizeClasses[size]} rounded-md object-contain`}
        />
      ) : (
        <Image
          src="/assets/images/tvinbio-logo.svg"
          alt="TVinBio"
          width={140}
          height={40}
          style={{ width: 'auto', height: 'auto' }}
          className={`${sizeClasses[size]} w-auto`}
        />
      )}
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
