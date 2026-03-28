'use client';
import ErrorPage from '@/components/Errorpage';
import Spinner from '@/components/Spinner';
import { getStreamById } from '@/features/streamAPI';
import { AppDispatch, RootState } from '@/store/store';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { BroadcastWithControls } from './broadcast/Broadcast';
import Cookies from 'js-cookie';

const StreamPage = () => {
  const searchParams = useSearchParams();
  let id = searchParams ? searchParams.get('id') : '';
  if (!id) {
    id = Cookies.get('activeStreamId') || '';
  }

  const dispatch = useDispatch<AppDispatch>();
  const { stream, loading, error } = useSelector(
    (state: RootState) =>
      state.streams as {
        stream: {
          id: string;
          streamKey: string;
          playbackId: string;
          name: string;
          isActive: boolean;
          createdAt: string;
        };
        loading: boolean;
        error: string | null;
      },
  );
  const navigate = useRouter();

  useEffect(() => {
    if (id) {
      dispatch(getStreamById(id));
    }
  }, [id, dispatch]);

  // Once the stream data is loaded, store it (or at least its ID) in cookies.
  useEffect(() => {
    if (stream && stream.id) {
      Cookies.set('activeStream', JSON.stringify(stream), { expires: 1 }); // store entire stream data if needed
      Cookies.set('activeStreamId', stream.id, { expires: 1 });
    }
  }, [stream]);

  if (loading) {
    return <Spinner />;
  } else if (!loading && !stream) {
    return <ErrorPage message="Stream not available." />;
  } else if (!loading && error) {
    return <ErrorPage message="Failed to fetch the stream. Please try again later." />;
  }

  const handleGoBack = () => {
    navigate.push('/dashboard');
  };

  if (!stream || !stream.streamKey || !stream.playbackId || !stream.name) {
    return (
      <div className="bg-white p-6 j rounded-lg shadow-md flex flex-col w-full items-center justify-center   min-h-screen  text-center">
        <h2 className="text-2xl font-bold mb-4">No ongoing stream</h2>
        <p className="text-gray-600 mb-4">Please start your stream from the dashboard.</p>
        <button
          className="bg-main-blue text-white py-2 px-4 rounded-md hover:bg-blue-700 transition duration-300"
          onClick={handleGoBack}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full items-center justify-center min-h-screen p bg-gray-100">
      <BroadcastWithControls
        streamName={stream.name}
        streamKey={stream.streamKey}
        streamId={stream.id}
        isActive={stream.isActive}
        createdAt={stream.createdAt}
        playbackId={stream.playbackId}
      />
    </div>
  );
};

export default StreamPage;
