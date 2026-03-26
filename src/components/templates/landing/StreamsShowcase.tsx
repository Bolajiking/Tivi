'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAllStreams, getUserProfilesBatch } from '@/lib/supabase-service';
import { SupabaseUser, SupabaseStream } from '@/lib/supabase-types';
import { Search } from 'lucide-react';

interface StreamsShowcaseProps {
  streams?: any[];
  loading?: boolean;
}

interface CreatorWithChannel {
  creator: SupabaseUser;
  channel: SupabaseStream;
}

/* ── Skeleton placeholder while loading ── */
function ChannelSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-[4/3] rounded-xl bg-raised" />
      <div className="mt-3 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-raised shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 bg-raised rounded w-3/4" />
          <div className="h-3 bg-raised rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}

export default function StreamsShowcase() {
  const [creatorsWithChannels, setCreatorsWithChannels] = useState<CreatorWithChannel[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const fetchChannelsWithCreators = async () => {
      setLoadingCreators(true);
      try {
        const allStreams = await getAllStreams();
        const streamsByCreator = new Map<string, SupabaseStream>();

        allStreams.forEach((stream) => {
          if (!stream.creatorId) return;
          const existing = streamsByCreator.get(stream.creatorId);
          if (!existing) {
            streamsByCreator.set(stream.creatorId, stream);
          } else {
            const existingDate = existing.created_at ? new Date(existing.created_at).getTime() : 0;
            const currentDate = stream.created_at ? new Date(stream.created_at).getTime() : 0;
            if (currentDate > existingDate) {
              streamsByCreator.set(stream.creatorId, stream);
            }
          }
        });

        const creatorIds = Array.from(streamsByCreator.keys());
        const profilesMap = await getUserProfilesBatch(creatorIds);

        const results: CreatorWithChannel[] = [];
        for (const [creatorId, channel] of streamsByCreator.entries()) {
          const creator = profilesMap.get(creatorId.toLowerCase());
          if (creator) {
            results.push({ creator, channel });
          }
        }

        setCreatorsWithChannels(results);
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        setLoadingCreators(false);
      }
    };

    fetchChannelsWithCreators();
  }, []);

  const filteredCreatorsWithChannels = useMemo(() => {
    if (!searchQuery.trim()) return creatorsWithChannels;
    const query = searchQuery.toLowerCase().trim();
    return creatorsWithChannels.filter(({ creator, channel }) => {
      const channelTitle = (channel.title || channel.streamName || '').toLowerCase();
      const creatorName = (creator.displayName || '').toLowerCase();
      return channelTitle.includes(query) || creatorName.includes(query);
    });
  }, [creatorsWithChannels, searchQuery]);

  return (
    <section className="px-4 md:px-6 pt-10 pb-6">
      {/* ── Page title ── */}
      <h1 className="text-[28px] md:text-[34px] font-bold font-funnel-display text-white tracking-[-0.4px] mb-6">
        Explore
      </h1>

      {/* ── Search bar ── */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[var(--text-3)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search channels"
            className={`w-full pl-10 pr-4 py-3 bg-raised rounded-xl text-[15px] text-white placeholder:text-[var(--text-3)] outline-none transition-all duration-150 border ${
              searchFocused
                ? 'border-[var(--accent)]/40'
                : 'border-white/[0.07]'
            }`}
          />
        </div>
      </div>

      {/* ── Channel grid ── */}
      {loadingCreators ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ChannelSkeleton key={i} />
          ))}
        </div>
      ) : filteredCreatorsWithChannels.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-6">
          {filteredCreatorsWithChannels.map(({ creator, channel }) => {
            const profileIdentifier = creator.displayName?.trim();
            if (!profileIdentifier) return null;

            const displayLogo = channel.logo || creator.avatar;
            const channelTitle = channel.title || channel.streamName || 'Untitled Channel';
            const creatorName = creator.displayName || `${creator.creatorId.slice(0, 5)}...${creator.creatorId.slice(-5)}`;
            const initials = (channelTitle || creatorName || '??').slice(0, 2).toUpperCase();

            return (
              <Link
                key={`${creator.creatorId}-${channel.playbackId || channel.id}`}
                href={`/creator/${encodeURIComponent(profileIdentifier)}`}
                className="group block"
              >
                {/* Thumbnail — no border, no shadow, rounded-xl */}
                <div className="aspect-[4/3] rounded-xl overflow-hidden relative bg-raised">
                  {displayLogo ? (
                    <Image
                      src={displayLogo}
                      alt={channelTitle}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-semibold text-[var(--text-2)]">
                        {initials}
                      </span>
                    </div>
                  )}
                </div>

                {/* Info row — avatar + text, directly on canvas */}
                <div className="mt-3 flex items-start gap-2.5">
                  {/* Creator avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-raised">
                    {creator.avatar ? (
                      <Image
                        src={creator.avatar}
                        alt={creatorName}
                        width={32}
                        height={32}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-medium text-[var(--text-2)]">
                        {creatorName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Text block */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-semibold text-white leading-tight truncate">
                      {channelTitle}
                    </h3>
                    <p className="text-[13px] text-[var(--text-2)] leading-tight mt-0.5 truncate">
                      {creatorName}
                    </p>
                    {channel.description && (
                      <p className="text-[12px] text-[var(--text-3)] leading-snug mt-1 line-clamp-1">
                        {channel.description}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : searchQuery.trim() ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="w-10 h-10 text-[var(--text-3)] mb-4" />
          <p className="text-[15px] text-[var(--text-2)]">
            No channels matching &ldquo;{searchQuery}&rdquo;
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-raised flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-[var(--text-3)]" />
          </div>
          <p className="text-[15px] text-[var(--text-2)]">No channels available yet.</p>
          <p className="text-[13px] text-[var(--text-3)] mt-1">Check back soon for new creators.</p>
        </div>
      )}
    </section>
  );
}
