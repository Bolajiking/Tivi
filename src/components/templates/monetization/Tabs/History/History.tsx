'use client';
import { useState, useEffect } from 'react';
import { ArrowDownRight, ArrowUpRight, Calendar } from 'lucide-react';

// Dummy data with more realistic transaction details
const transactions = [
  {
    id: 1,
    type: 'Donation',
    user: '@User123',
    amount: 10.0,
    date: 'Today, 2:20 PM',
    timestamp: new Date('2023-12-13T14:20:00'),
  },
  {
    id: 2,
    type: 'Donation',
    user: '@mikeviewer',
    amount: 5.0,
    date: 'Today, 2:20 PM',
    timestamp: new Date('2023-12-13T14:20:00'),
  },
  {
    id: 3,
    type: 'Withdrawal',
    description: 'via wallet address',
    amount: 1200.0,
    date: 'Yesterday, 4:32 PM',
    timestamp: new Date('2023-12-12T16:32:00'),
  },
  {
    id: 4,
    type: 'Donation',
    user: '@0xcrypt',
    amount: 5.0,
    date: '12-12-24, 11:20 AM',
    timestamp: new Date('2023-12-12T11:20:00'),
  },
  {
    id: 5,
    type: 'Store',
    description: 'Purchase - Limited Edition Hoodie',
    amount: 100.0,
    date: '11-12-24, 1:32 AM',
    timestamp: new Date('2023-12-11T01:32:00'),
  },
  {
    id: 6,
    type: 'Withdrawal',
    description: 'via Stripe',
    amount: 500.0,
    date: '11-12-24, 1:32 AM',
    timestamp: new Date('2023-12-11T01:32:00'),
  },
  {
    id: 7,
    type: 'Store',
    description: 'Purchase - Custom T (SE)',
    amount: 200.0,
    date: '11-12-24, 1:32 AM',
    timestamp: new Date('2023-12-11T01:32:00'),
  },
  {
    id: 8,
    type: 'Withdrawal',
    description: 'via Ramp',
    amount: 600.0,
    date: '10-12-24, 1:32 AM',
    timestamp: new Date('2023-12-10T01:32:00'),
  },
];

const History = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [filteredTransactions, setFilteredTransactions] = useState(transactions);

  useEffect(() => {
    if (activeFilter === 'All') {
      setFilteredTransactions(transactions);
    } else if (activeFilter === 'Subscription') {
      setFilteredTransactions(transactions.filter((t) => t.type === 'Subscription'));
    } else if (activeFilter === 'Withdrawals') {
      setFilteredTransactions(transactions.filter((t) => t.type === 'Withdrawal'));
    } else if (activeFilter === 'Donations') {
      setFilteredTransactions(transactions.filter((t) => t.type === 'Donation'));
    } else if (activeFilter === 'Store Sales') {
      setFilteredTransactions(transactions.filter((t) => t.type === 'Store'));
    }
  }, [activeFilter]);

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6">
      <h1 className="text-2xl font-bold mb-6 text-white">Transaction History</h1>

      {/* Filter Buttons */}
      <div className="flex justify-beween mb-6 space-x-3">
        <div className="md:flex  space-x-2 overflow-x-auto pb-2">
          <FilterButton label="All" active={activeFilter === 'All'} onClick={() => setActiveFilter('All')} />
          <FilterButton
            label="Withdrawals"
            active={activeFilter === 'Withdrawals'}
            onClick={() => setActiveFilter('Withdrawals')}
          />
          <FilterButton
            label="Subscription"
            active={activeFilter === 'Subscription'}
            onClick={() => setActiveFilter('Subscription')}
          />
          <FilterButton
            label="Donations"
            active={activeFilter === 'Donations'}
            onClick={() => setActiveFilter('Donations')}
          />
          <FilterButton
            label="Store Sales"
            active={activeFilter === 'Store Sales'}
            onClick={() => setActiveFilter('Store Sales')}
          />
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-4 mb-8">
        {filteredTransactions.map((transaction) => (
          <div key={transaction.id} className="border border-white/20 bg-white/5 rounded-xl p-4 flex justify-between items-center">
            <div className="flex items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 ${
                  transaction.type === 'Withdrawal' ? 'bg-red-100' : 'bg-green-100'
                }`}
              >
                {transaction.type === 'Withdrawal' ? (
                  <ArrowUpRight className="text-red-500 w-6 h-6" />
                ) : (
                  <ArrowDownRight className="text-green-500 w-6 h-6" />
                )}
              </div>
              <div>
                <p className="font-medium text-lg text-white">
                  {transaction.type === 'Donation' && `Donation from ${transaction.user}`}
                  {transaction.type === 'Withdrawal' && `Withdrawal ${transaction.description}`}
                  {transaction.type === 'Store' && `Store ${transaction.description}`}
                  {transaction.type === 'Subscription' && `Subscription from ${transaction.user}`}
                </p>
                <p className="text-gray-400 text-sm">{transaction.date}</p>
              </div>
            </div>
            <div>
              <p
                className={`text-xl font-semibold ${
                  transaction.type === 'Withdrawal' ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {transaction.type === 'Withdrawal' ? '-' : '+'}${transaction.amount.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TabButton = ({ label, active }: { label: string; active: boolean }) => {
  return (
    <button
      className={`px-4 py-3 font-medium whitespace-nowrap ${
        active ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );
};

const FilterButton = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
        active ? 'bg-white/20 border border-white/30 text-white' : 'text-gray-300 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
};

export default History;
