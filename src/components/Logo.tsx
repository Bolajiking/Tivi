'use client';
import Link from 'next/link';
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
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl md:text-4xl',
  };

  const LogoContent = () => (
    <div className="relative inline-block group cursor-pointer">
      {/* Glow effect on hover */}
      <div className="absolute -inset-2 bg-gradient-to-r from-yellow-500/30 via-teal-500/30 to-yellow-500/30 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Background glow (subtle) */}
      <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500/10 via-teal-500/10 to-yellow-500/10 blur-md rounded-full opacity-50" />
      
      {/* Main logo */}
      <div className="relative flex items-center gap-1 px-1">
        {/* Gradient text with animation */}
        <span 
          className={`font-funnel-display font-bold bg-gradient-to-r from-yellow-400 via-teal-400 to-yellow-400 bg-clip-text text-transparent ${sizeClasses[size]} tracking-tight relative z-10`}
          style={{
            backgroundImage: 'linear-gradient(90deg, #facc15, #14b8a6, #facc15)',
            backgroundSize: '200% auto',
            animation: 'gradient-x 3s ease infinite',
          }}
        >
          Chainfren
        </span>
        
        {/* TV accent with subtle glow */}
        <span className={`font-funnel-display font-bold text-white ${sizeClasses[size]} tracking-tight relative z-10 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]`}>
          TV
        </span>
      </div>
      
      {/* Decorative accent dot */}
      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-gradient-to-r from-yellow-400 to-teal-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg shadow-yellow-500/50" />
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

