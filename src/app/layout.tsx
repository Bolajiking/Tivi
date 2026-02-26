'use client';

// import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import React from 'react';
import './globals.css';
// import Providers from './providers';
// import { headers } from 'next/headers';
// import '@coinbase/onchainkit/styles.css';
// import { cookieToInitialState } from 'wagmi';
// import getConfig from 'next/config';
import { PrivyProvider } from '@privy-io/react-auth';
import {Provider} from 'react-redux';
import store from '../store/store';

// export const metadata: Metadata = {
//   title: 'Switch TV',
//   description: 'Switch TV',
//   icons: {
//     icon: './assets/images/favicon.ico',
//   },
// };
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>TVinBio - Your Audience. Your Platform. Your Revenue.</title>
        <meta name="description" content="TVinBio - The personalized streaming platform that lives in your social bio. Full control over your audience, monetization, and data." />
        <meta name="base:app_id" content="69678d800c770beef048620f" />
        <link rel="icon" href="/assets/images/icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@400;500;600;700;800&family=Host+Grotesk:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
          <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_ENVIRONMENT_ID ?? ''}
      config={{
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          }
        },
        appearance: {
          landingHeader: '',
          loginMessage: 'Welcome to TVinBio',
          theme: 'light',
          accentColor: '#facc15', // Yellow to match TVinBio branding
          logo: '',
          // showWalletLoginFirst: false,
          walletChainType:'ethereum-only',
          walletList: [ 'metamask','wallet_connect','rainbow','binance','coinbase_wallet'],
        
        },
    
        loginMethods:['wallet','email','farcaster'],
      }}
    >
       
       <Provider store={store}>
          <main>
            <Toaster position="top-center" richColors />
            {children}
          </main>
         
        </Provider>
        </PrivyProvider>
      </body>
    </html>
  );
}
