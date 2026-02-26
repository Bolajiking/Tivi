'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getAllStreams, getUserProfile } from '@/lib/supabase-service';
import { SupabaseUser, SupabaseStream } from '@/lib/supabase-types';
import Spinner from '@/components/Spinner';
import { FaSearch } from 'react-icons/fa';

interface StreamsShowcaseProps {
  streams: any[];
  loading: boolean;
}

interface CreatorWithChannel {
  creator: SupabaseUser;
  channel: SupabaseStream; // Most recent stream for this creator
}

export default function StreamsShowcase({ streams, loading }: StreamsShowcaseProps) {
  const [creatorsWithChannels, setCreatorsWithChannels] = useState<CreatorWithChannel[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all streams (source of truth) and get creator info for each
  useEffect(() => {
    const fetchChannelsWithCreators = async () => {
      setLoadingCreators(true);
      try {
        // Get all streams from streams table (source of truth)
        const allStreams = await getAllStreams();
        
        // Group streams by creatorId and get the most recent stream per creator
        const streamsByCreator = new Map<string, SupabaseStream>();
        
        allStreams.forEach((stream) => {
          if (!stream.creatorId) return; // Skip streams without creatorId
          
          const existingStream = streamsByCreator.get(stream.creatorId);
          if (!existingStream) {
            // First stream for this creator
            streamsByCreator.set(stream.creatorId, stream);
          } else {
            // Compare dates to keep the most recent one
            const existingDate = existingStream.created_at ? new Date(existingStream.created_at).getTime() : 0;
            const currentDate = stream.created_at ? new Date(stream.created_at).getTime() : 0;
            if (currentDate > existingDate) {
              streamsByCreator.set(stream.creatorId, stream);
            }
          }
        });
        
        // Fetch creator info for each unique creatorId
        const creatorsWithChannelData = await Promise.all(
          Array.from(streamsByCreator.entries()).map(async ([creatorId, channel]) => {
            try {
              const creator = await getUserProfile(creatorId);
              if (!creator) {
                // Skip if creator not found
                return null;
              }
              return {
                creator,
                channel,
              };
            } catch (error) {
              console.error(`Failed to fetch creator ${creatorId}:`, error);
              return null;
            }
          })
        );
        
        // Filter out null entries (streams without valid creators)
        const validChannels = creatorsWithChannelData.filter(
          (item): item is CreatorWithChannel => item !== null
        );
        
        setCreatorsWithChannels(validChannels);
      } catch (error) {
        console.error('Failed to fetch channels:', error);
      } finally {
        setLoadingCreators(false);
      }
    };

    fetchChannelsWithCreators();
  }, []);

  // Filter creators/channels based on search query
  const filteredCreatorsWithChannels = useMemo(() => {
    if (!searchQuery.trim()) {
      return creatorsWithChannels;
    }

    const query = searchQuery.toLowerCase().trim();
    return creatorsWithChannels.filter(({ creator, channel }) => {
      // Get channel title
      const channelTitle = (channel.title || channel.streamName || '').toLowerCase();
      // Get creator name
      const creatorName = (creator.displayName || '').toLowerCase();
      
      // Match against channel title or creator name
      return channelTitle.includes(query) || creatorName.includes(query);
    });
  }, [creatorsWithChannels, searchQuery]);

  return (
    <section id="streams-showcase" className="py-8 px-4 relative">
      {/* Search Bar */}
      <div className="mb-12 max-w-2xl mx-auto">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <FaSearch className="text-gray-400 w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for your favorite channels"
            className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-[1px] border border-white/20 rounded-full text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500/50 focus:border-yellow-500/50 transition-all"
          />
        </div>
      </div>
      
      {/* Main Column - All Channels */}
      {loadingCreators ? (
        <div className="flex justify-center items-center h-32">
          <Spinner />
        </div>
      ) : filteredCreatorsWithChannels && filteredCreatorsWithChannels.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredCreatorsWithChannels.map(({ creator, channel }) => {
            const profileIdentifier = creator.displayName?.trim();
            if (!profileIdentifier) return null;
            // Use channel logo if available, otherwise fallback to creator avatar
            const displayLogo = channel.logo || creator.avatar;
            // Use channel title/streamName if available
            const channelTitle = channel.title || channel.streamName || 'Untitled Channel';
            // Creator display name
            const creatorName = creator.displayName || `${creator.creatorId.slice(0, 5)}...${creator.creatorId.slice(-5)}`;
            
            return (
              <Link
                key={`${creator.creatorId}-${channel.playbackId || channel.id}`}
                href={`/creator/${encodeURIComponent(profileIdentifier)}`}
                className="block bg-white/10 rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform"
              >
                <div className="h-40 bg-gray-800 flex items-center justify-center relative">
                  {displayLogo ? (
                    <Image
                      src={displayLogo}
                      alt={channelTitle}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-yellow-500/20 via-teal-500/20 to-yellow-500/20 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-yellow-500 to-teal-500 flex items-center justify-center text-black text-2xl font-bold">
                        {(channelTitle || creator.displayName || creator.creatorId?.slice(0, 2) || '??').toUpperCase().slice(0, 2)}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-1 truncate">
                    {channelTitle}
                  </h3>
                  <p className="text-xs text-yellow-300 mb-1">
                    by {creatorName}
                  </p>
                  {channel.description && (
                    <p className="text-xs text-gray-400 line-clamp-2">{channel.description}</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : searchQuery.trim() ? (
        <div className="text-center text-gray-400 py-12">
          No channels found matching "{searchQuery}"
        </div>
      ) : (
        <div className="text-center text-gray-400 py-12">No channels available at the moment.</div>
      )}
    </section>
  );
}
