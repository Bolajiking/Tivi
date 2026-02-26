'use client';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

// Header component
function HeroHeader() {
  return (
    <header className="w-full flex items-center justify-between py-6 px-4 md:px-12">
      <div className="flex items-center gap-2">
        <Image
          src="/assets/images/tvinbio-logo.svg"
          alt="TVinBio"
          width={140}
          height={40}
          style={{ width: 'auto', height: 'auto' }}
          className="h-8 md:h-10 w-auto"
        />
      </div>
      <div className="flex items-center gap-4">
        <Link href="/streamviews" className="hidden md:block text-gray-300 hover:text-white transition-colors text-sm font-medium">
          Explore
        </Link>
        <Link href="/dashboard">
          <button className="font-host-grotesk bg-white text-black font-semibold px-5 py-2.5 rounded-full text-sm hover:bg-gray-100 transition-colors">
            Join Beta
          </button>
        </Link>
      </div>
    </header>
  );
}

export default function Hero() {
  const { login } = usePrivy();
  const router = useRouter();

  return (
    <section className="relative min-h-screen">
      <HeroHeader />

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center px-4 md:px-12 pt-12 md:pt-20 pb-16">
        {/* Beta Badge */}
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-sm text-gray-300">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Beta Launch — Limited Access
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="font-funnel-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white text-center mb-6 leading-[1.1] max-w-4xl">
          Your Audience.
          <br />
          <span className="bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 bg-clip-text text-transparent">
            Your Platform.
          </span>
          <br />
          Your Revenue.
        </h1>

        {/* Subtitle */}
        <p className="font-host-grotesk text-lg md:text-xl text-gray-400 text-center mb-10 max-w-2xl leading-relaxed">
          The personalized streaming platform that lives in your social bio.
          Full control over your audience, monetization, and data.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link href="/dashboard">
            <button className="font-host-grotesk px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 text-base">
              Start Streaming Free
            </button>
          </Link>
          <Link href="/streamviews">
            <button className="font-host-grotesk px-8 py-4 bg-white/5 backdrop-blur-sm text-white font-medium rounded-full border border-white/20 hover:bg-white/10 transition-all duration-200 text-base">
              See It In Action
            </button>
          </Link>
        </div>

        {/* Hero Visual */}
        <div className="w-full max-w-5xl mx-auto relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none rounded-2xl"></div>
          <div className="relative bg-gradient-to-br from-gray-900/80 to-gray-800/50 rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs text-gray-500 font-mono">tvin.bio/yourname</span>
              </div>
            </div>
            <Image
              src="/assets/images/stram.png"
              alt="TVinBio Platform Preview"
              width={1200}
              height={675}
              className="w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Value Props Section */}
      <section className="py-20 px-4 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-funnel-display text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Built for creators who want more
          </h2>
          <p className="font-host-grotesk text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Stop renting your audience. Own your platform, keep your revenue, control your data.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-funnel-display text-xl font-semibold text-white mb-3">Stream Anywhere</h3>
              <p className="font-host-grotesk text-gray-400 text-sm leading-relaxed">
                Go live in seconds. Your channel lives in your bio link — accessible to all your followers across every platform.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500/20 to-teal-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-funnel-display text-xl font-semibold text-white mb-3">Keep 100% Revenue</h3>
              <p className="font-host-grotesk text-gray-400 text-sm leading-relaxed">
                Subscriptions, tips, pay-per-view, and commerce. Direct to your wallet with zero platform fees during beta.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-funnel-display text-xl font-semibold text-white mb-3">Own Your Data</h3>
              <p className="font-host-grotesk text-gray-400 text-sm leading-relaxed">
                Full analytics, subscriber lists, and engagement data. Your audience belongs to you, not the algorithm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 md:px-12 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-funnel-display text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Launch in 3 steps
          </h2>
          <p className="font-host-grotesk text-gray-400 text-center mb-16">
            Your streaming platform, ready in minutes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
            {/* Step 1 */}
            <div className="relative text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-black">
                1
              </div>
              <h3 className="font-funnel-display text-lg font-semibold text-white mb-2">Create Your Channel</h3>
              <p className="font-host-grotesk text-gray-400 text-sm">
                Sign up, customize your page, set your monetization preferences.
              </p>
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-yellow-500/50 to-transparent"></div>
            </div>

            {/* Step 2 */}
            <div className="relative text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-teal-500 flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-black">
                2
              </div>
              <h3 className="font-funnel-display text-lg font-semibold text-white mb-2">Add to Your Bio</h3>
              <p className="font-host-grotesk text-gray-400 text-sm">
                Drop your TVinBio link in Instagram, TikTok, Twitter, YouTube — everywhere.
              </p>
              {/* Connector line */}
              <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-px bg-gradient-to-r from-green-500/50 to-transparent"></div>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-black">
                3
              </div>
              <h3 className="font-funnel-display text-lg font-semibold text-white mb-2">Go Live & Earn</h3>
              <p className="font-host-grotesk text-gray-400 text-sm">
                Stream, upload content, sell products. All revenue goes directly to you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 md:px-12">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-funnel-display text-3xl md:text-4xl font-bold text-white text-center mb-4">
            Perfect for every creator
          </h2>
          <p className="font-host-grotesk text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            From fitness coaches to musicians, educators to gamers — your audience deserves a premium experience.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '🎮', label: 'Gamers' },
              { icon: '💪', label: 'Fitness' },
              { icon: '🎵', label: 'Musicians' },
              { icon: '📚', label: 'Educators' },
              { icon: '🎨', label: 'Artists' },
              { icon: '👨‍🍳', label: 'Chefs' },
              { icon: '🛍️', label: 'Brands' },
              { icon: '🎙️', label: 'Podcasters' },
            ].map((item, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 text-center hover:bg-white/10 transition-colors">
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="font-host-grotesk text-white text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 md:px-12">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20">
            <h2 className="font-funnel-display text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to own your platform?
            </h2>
            <p className="font-host-grotesk text-gray-400 mb-8 max-w-lg mx-auto">
              Join the beta and get early access. Limited spots available for creators who want to build their empire.
            </p>
            <Link href="/dashboard">
              <button className="font-host-grotesk px-10 py-4 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 text-lg">
                Get Early Access
              </button>
            </Link>
            <p className="font-host-grotesk text-gray-500 text-sm mt-4">
              Free during beta. No credit card required.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
