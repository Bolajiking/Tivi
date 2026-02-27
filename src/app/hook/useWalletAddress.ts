import { useMemo } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';

export function useWalletAddress() {
  const { user } = usePrivy();
  const { wallets } = useWallets();

  const walletAddress = useMemo(() => {
    if (wallets && wallets.length > 0) {
      const externalWallet = wallets.find(
        (wallet: any) =>
          wallet.walletClientType !== 'privy' &&
          wallet.clientType !== 'privy' &&
          wallet.connectorType !== 'privy',
      );
      if (externalWallet?.address) {
        return externalWallet.address;
      }

      const embeddedWallet = wallets.find(
        (wallet: any) =>
          wallet.walletClientType === 'privy' ||
          wallet.clientType === 'privy' ||
          wallet.connectorType === 'privy',
      );
      if (embeddedWallet?.address) {
        return embeddedWallet.address;
      }

      if (wallets[0]?.address) {
        return wallets[0].address;
      }
    }

    if (user?.linkedAccounts && user.linkedAccounts.length > 0) {
      const walletAccount = user.linkedAccounts.find(
        (account: any) => account.type === 'wallet' && 'address' in account && account.address,
      );
      if (walletAccount && 'address' in walletAccount && walletAccount.address) {
        return walletAccount.address;
      }
    }

    const userWalletAddress = (user as any)?.wallet?.address;
    if (typeof userWalletAddress === 'string' && userWalletAddress.trim()) {
      return userWalletAddress;
    }

    return null;
  }, [wallets, user?.linkedAccounts, (user as any)?.wallet?.address]);

  return { walletAddress, wallets };
}
