import { Suspense } from 'react';
import Dashboard from '@/components/templates/dashboard/Dashboard';
import Spinner from '@/components/Spinner';

const Page = () => {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen bg-gradient-to-br from-black via-gray-950 to-black">
          <Spinner />
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
};

export default Page;
