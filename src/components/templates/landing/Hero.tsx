'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Logo from '@/components/Logo';

// Header component
function HeroHeader() {
  return (
    <header className="w-full flex items-center justify-between py-6 px-4 md:px-8">
      <Logo size="lg" />
      <Link href="/dashboard">
        <button className="font-host-grotesk bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black font-semibold px-6 py-2 rounded-md transition-colors">
          Get Started
        </button>
      </Link>
    </header>
  );
}

export default function Hero() {
  const { login } = usePrivy();
  const router = useRouter();

  // Contract address - will be set when ready
  const contractAddress = '7XKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

  // Truncate contract address for display (responsive)
  const truncateAddress = (address: string, startChars: number = 4, endChars: number = 4) => {
    if (!address || address.length <= startChars + endChars) return address;
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  };

  return (
    <section className="relative  ">
      <HeroHeader />
      <section className="relative flex flex-col md:flex-row justify-between items-end px-16">
        {/* Background Pattern */}
        {/* <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-indigo-900/20"> */}
          {/* <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" fill="none" fill-rule="evenodd" fill="ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div> */}
        {/* </div> */}

        <div className="relative z-10 md:mt-28  mt-20 text-center md:text-left ">


          {/* Main Heading */}
          <h1 className="font-funnel-display text-4xl sm:text-5xl lg:text-7xl  font-bold text-white mb-6 leading-tight">
            The Future of
            <span className="block bg-gradient-to-r from-yellow-400 to-teal-400 bg-clip-text text-transparent">
              Live Streaming
            </span>
            is Here
          </h1>

          {/* Subtitle */}
          <p className="font-host-grotesk text-md  text-gray-300 mb-8 max-w-lg leading-tight">
            Create, stream, and monetize your content without middlemen. 
            Join the next generation of content creators on ChainfrenTV.
          </p>

          <p className="font-host-grotesk text-md mb-8 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-teal-500  max-w-lg leading-tight">
           powered by Solana and x402
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-start items-center">
            <button
              
              className="font-host-grotesk px-8 py-4 bg-gradient-to-r from-yellow-500 to-teal-500 text-black font-semibold rounded-lg hover:from-yellow-600 hover:to-teal-600 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >

             <Link href="/dashboard"> Get Started</Link>
            </button>
            <button
              
              className="font-host-grotesk px-8 py-4 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200"
            >
              <Link href="/streamviews"> Explore Streams</Link>
            </button>
          </div>

        </div>
        <div className="w-full md:w-1/2 flex md:justify-end justify-center mt-10 md:mt-0 items-start h-full">
          <Image src="/assets/images/stram.png" alt="Hero Image" width={500} height={500} className="md:w-[80%] w-[100%] object-contain rounded-lg" />
        </div>
      </section>
      
          {/* Stats */}
          <section className="mt-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="font-funnel-display text-3xl font-bold text-white mb-2">1000+</div>
              <div className="font-host-grotesk text-gray-300 text-sm">Active Creators</div>
            </div>
            <div className="text-center">
              <div className="font-funnel-display text-3xl font-bold text-white mb-2">50K+</div>
              <div className="font-host-grotesk text-gray-300 text-sm">Total Streams</div>
            </div>
            <div className="text-center">
              <div className="font-funnel-display text-3xl font-bold text-white mb-2">1M+</div>
              <div className="font-host-grotesk text-gray-300 text-sm">Viewers</div>
            </div>
            <div className="text-center">
              <div className="font-funnel-display text-3xl font-bold text-white mb-2">$500K+</div>
              <div className="font-host-grotesk text-gray-300 text-sm">Paid to Creators</div>
            </div>
          </div>

            {/* Feature Highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 max-w-4xl mx-auto mt-16">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 group">
              <div className="w-12 h-12 group-hover:bg-yellow-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-funnel-display text-lg font-semibold text-white mb-2">Live Streaming</h3>
              <p className="font-host-grotesk text-gray-300 text-sm">High-quality live streaming with real-time chat and viewer engagement</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 group">
              <div className="w-12 h-12 group-hover:bg-gradient-to-r from-yellow-500 to-teal-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <h3 className="font-funnel-display text-lg font-semibold text-white mb-2">Monetization</h3>
              <p className="font-host-grotesk text-gray-300 text-sm">Multiple revenue streams including subscriptions, donations, and product sales</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 group">
              <div className="w-12 h-12 group-hover:bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-funnel-display text-lg font-semibold text-white mb-2">Web3 Integration</h3>
              <p className="font-host-grotesk text-gray-300 text-sm">Built on blockchain technology with secure wallet integration</p>
            </div>
          </div>
          </section>

          {/*Contract Address*/}
          <section className="mt-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 md:p-8 border border-white/20 shadow-lg">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-teal-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="font-funnel-display text-xl md:text-2xl font-semibold text-white">
                        Contract Address
                      </h3>
                    </div>
                    <p className="font-host-grotesk text-gray-300 text-sm mb-4">
                      Verified smart contract address on Solana
                    </p>
                    <div className="bg-black/20 backdrop-blur-sm max-w-md rounded-lg p-4 border border-white/10 flex items-center gap-3 group overflow-hidden">
                      {/* Mobile: show less characters */}
                      <code className="text-xs sm:text-sm md:text-base text-gray-400 flex-1 font-mono blur-sm select-none md:hidden">
                        {truncateAddress(contractAddress, 4, 4)}
                      </code>
                      {/* Desktop: show more characters */}
                      <code className="hidden md:block text-xs sm:text-sm md:text-base text-gray-400 flex-1 font-mono blur-sm select-none">
                        {truncateAddress(contractAddress, 8, 8)}
                      </code>
                      <button
                        disabled
                        className="opacity-50 cursor-not-allowed p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
                        title="Copy address"
                      >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:ml-4">
                    <button
                      disabled
                      className="font-host-grotesk px-6 py-3 bg-gradient-to-r from-yellow-500/50 to-teal-500/50 text-white/70 font-semibold rounded-lg border border-white/20 cursor-not-allowed opacity-60 transition-all duration-200 flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on Explorer
                    </button>
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-host-grotesk">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Coming Soon
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
    </section>
  );
} 