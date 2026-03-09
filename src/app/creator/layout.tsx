import { ReactNode } from 'react';
import { ChannelProvider } from '@/context/ChannelContext';

export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <ChannelProvider>{children}</ChannelProvider>;
}
