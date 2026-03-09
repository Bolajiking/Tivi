'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import Money from './Tabs/Monetize';
// import Subscription from './Tabs/Subscription';
import Donations from './Tabs/Donations';
import Store from './Tabs/Store/Store';
import Header from '@/components/Header';
import History from './Tabs/History/History';
import { useState } from 'react';
import MobileSidebar from '@/components/MobileSidebar';

const Monetization: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };
  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      {/* Mobile Sidebar */}
      {mobileMenuOpen && (
        <MobileSidebar
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen h-full">
        <Header toggleMenu={toggleMobileMenu} mobileOpen={mobileMenuOpen} />
        <div className="mx-auto w-full max-w-[1200px] mt-14 md:mt-4 border border-white/[0.07] rounded-xl min-h-[85vh] overflow-auto bg-[#0f0f0f] pb-6 px-3 md:px-6">
          <Tabs defaultValue="overview" className="w-full mx-auto">
            <TabsList className="justify-start items-center flex flex-wrap h-full shadow-none rounded-none my-5 bg-transparent border-b border-white/[0.07] p-0 gap-2">
              <TabsTrigger
                value="overview"
                className="text-[#888] font-normal md:text-sm data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-[#facc15] data-[state=active]:shadow-none rounded-none pb-3"
              >
                Overview
              </TabsTrigger>
              {/* <TabsTrigger value="subcription">Subcriptions</TabsTrigger> */}
              <TabsTrigger
                value="donations"
                className="text-[#888] font-normal md:text-sm data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-[#facc15] data-[state=active]:shadow-none rounded-none pb-3"
              >
                Donations
              </TabsTrigger>
              <TabsTrigger
                value="store"
                className="text-[#888] font-normal md:text-sm data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-[#facc15] data-[state=active]:shadow-none rounded-none pb-3"
              >
                Store
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="text-[#888] font-normal md:text-sm data-[state=active]:text-white data-[state=active]:font-bold data-[state=active]:border-b-2 data-[state=active]:border-[#facc15] data-[state=active]:shadow-none rounded-none pb-3"
              >
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="md:w-[90%] max-sm:w-full">
              <Money />
            </TabsContent>
            {/* <TabsContent value="subcription" className="md:w-[55%] max-sm:w-full">
              <Subscription />
            </TabsContent> */}
            <TabsContent value="donations" className="md:w-[55%] max-sm:w-full">
              <Donations />
            </TabsContent>
            <TabsContent value="store" className="md:w-[65%] max-sm:w-full">
              <Store />
            </TabsContent>
            <TabsContent value="history" className="md:w-[55%] max-sm:w-full">
              <History />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Monetization;
