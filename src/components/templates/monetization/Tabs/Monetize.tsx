import Ramp from '@/assets/Ramp.png';
import Tranzak from '@/assets/Tranzak.png';
import Stripe from '@/assets/Stripe.png';
import Lefi from '../../../../assets/Lefi.png';
import { AiOutlineExclamationCircle } from 'react-icons/ai';
import { useState } from 'react';
import Image from 'next/image';
// import { useEthBalance } from '@/app/providers';
import SendTransaction from '@/components/SendTransaction';
import { usePrivy } from '@privy-io/react-auth';
const Monetize = () => {
  const { sendTransaction: send } = usePrivy();
  // const { ethBalance } = useEthBalance();
  const [showPayment, setShowPayment] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalAddress, setWithdrawalAddress] = useState('');

  const showPaymntHandler = () => {
    setShowPayment(!showPayment);
  };

  const dummyData = [
    { id: 1, name: 'Revenue', balance: '$0.00' },
    { id: 2, name: 'Subscribers', balance: '$0.00' },
    { id: 3, name: 'Store Holders', balance: '$0.00' },
  ];

  return (
    <div>
      <div className=" max-sm:flex flex-col md:grid md:grid-cols-8   md:gap-x-5">
        <div className="bg-white/5 shadow-lg md:p-6 p-4 rounded-xl border border-white/20 md:col-span-3 w-full">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black flex flex-col text-white h-[170px] justify-around p-4 rounded-lg border border-white/10">
            <div className="flex justify-between items-center pb-4 pt-2 px-3">
              <p className="text-xl font-normal">Wallet Balance</p>
              <button className="text-gray-400 text-sm">History</button>
            </div>
            {/* <p className="text-xl py-4 px-3 font-semibold">{ethBalance ? `${ethBalance} ETH` : '***'}</p> */}
            {/* <p className="text-xs text-gray-400 pt-2  px-3 self-end">{chainName?.split(' ')[0]}</p> */}
          </div>
          <div className="mt-6">
            <button
              className={`capitalize w-full p-[8px] bg-main-blue rounded-md text-white ${showPayment ? 'hidden' : ''}`}
              onClick={showPaymntHandler}
            >
              withdraw
            </button>
          </div>

          {showPayment && (
            <div>
              <p className="font-semibold text-black my-4">Choose Payment Method</p>
              <label className="font-semibold text-[#9EAAB6]">Amount</label>
              <input
                type="number"
                placeholder="withdrawal Amount ETH"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="w-full p-2 mt-2 border border-white/20 bg-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none"
              />

              <label className="font-semibold mt-[10px] text-[#9EAAB6] flex gap-2 items-center">
                Wallet Address <AiOutlineExclamationCircle className="text-lg" />
              </label>
              <input
                type="text"
                placeholder="Wallet address"
                value={withdrawalAddress}
                onChange={(e) => setWithdrawalAddress(e.target.value)}
                className="w-full p-2 mt-2 border border-white/20 bg-white/10 rounded-md text-white placeholder-gray-400 focus:outline-none"
              />

              <SendTransaction sendTransaction={send} sendAddress={withdrawalAddress} amount={withdrawalAmount} />

              <p className="text-center text-[#5D7285] text-sm p-[10px]"> Or use </p>
              <div className="flex justify-around mt-2">
                <div className="w-14 h-14 relative">
                  <Image src={Stripe} alt="Stripe" layout="fill" objectFit="contain" />
                </div>
                <div className="w-14 h-14 relative">
                  <Image src={Lefi} alt="Lefi" layout="fill" objectFit="contain" />
                </div>
                <div className="w-14 h-14 relative">
                  <Image src={Ramp} alt="Ramp" layout="fill" objectFit="contain" />
                </div>
                <div className="w-14 h-14 relative">
                  <Image src={Tranzak} alt="Tranzak" layout="fill" objectFit="contain" />
                </div>
              </div>
              <div className="bg-white/10 border border-white/20 flex rounded-md gap-3 p-2 mt-[20px] text-gray-200">
                <AiOutlineExclamationCircle className="flex text-4xl text-[#5D7285]" />
                <p className="text-sm">
                  Funds may be irrecoverable if you enter an incorrect wallet address. It is crucial to ensure the
                  accuracy of the provided wallet address to avoid any loss.
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="w-full mt-4 md:mt-0 md:col-span-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dummyData.map(({ id, name, balance }) => (
              <div key={id} className="border border-white/20 bg-white/5 rounded-xl p-4">
                <h3 className="font-bold text-xl text-white pb-3">{name}</h3>
                <p className="text-2xl font-bold text-white">{balance}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monetize;
