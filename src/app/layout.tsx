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
import { SolanaProvider } from '@/context/solProv';
import { PrivyProvider } from '@privy-io/react-auth';
import {Provider} from 'react-redux';
import store from '../store/store';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

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
    <html lang="en">
      <head>
        <title>ChainfrenTV</title>
        <meta name="description" content="ChainfrenTV - Live Streaming on Solana" />
        <link rel="icon" href="/assets/images/icinn.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@400;500;600;700;800&family=Host+Grotesk:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
      <SolanaProvider customRpcUrl="https://solana-devnet.g.alchemy.com/v2/8rgdAH9Vy_zuXQFA2hedqK_a_3GAxvuZ">
          <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_ENVIRONMENT_ID ?? ''}
      config={{
        appearance: {
          landingHeader: '',
          loginMessage: 'Welcome to ChainfrenTV',
          theme: 'light',
          accentColor: '#facc15', // Yellow to match ChainfrenTV branding
          logo: '',
          // showWalletLoginFirst: false,
          walletChainType:'ethereum-and-solana',
          walletList: [ 'phantom','metamask','wallet_connect','rainbow','binance','coinbase_wallet'],
        
        },
        externalWallets: {solana: {connectors: toSolanaWalletConnectors()}},
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
        </SolanaProvider>
      </body>
    </html>
  );
}
