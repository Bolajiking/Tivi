import { base } from 'viem/chains';
import { encodeFunctionData, erc20Abi, isAddress, parseUnits } from 'viem';

export const BASE_CHAIN_ID = base.id;
export const BASE_CHAIN_NAME = 'Base';
export const USDC_DECIMALS = 6;
export const USDC_SYMBOL = 'USDC';

// Base mainnet USDC by default; can be overridden for test environments.
export const BASE_USDC_CONTRACT =
  (process.env.NEXT_PUBLIC_BASE_USDC_CONTRACT as `0x${string}` | undefined) ||
  ('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const);

const normalizeAddress = (value: string): `0x${string}` => {
  const normalized = value.startsWith('0x') ? value : `0x${value}`;
  if (!isAddress(normalized)) {
    throw new Error('Invalid recipient wallet address.');
  }
  return normalized as `0x${string}`;
};

export const toUsdcUnits = (amountUsd: number) => {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error('Invalid USDC amount.');
  }
  return parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);
};

export const buildBaseUsdcTransferTx = (recipientAddress: string, amountUsd: number) => {
  const recipient = normalizeAddress(recipientAddress);
  const amount = toUsdcUnits(amountUsd);

  return {
    to: BASE_USDC_CONTRACT,
    value: '0x0' as `0x${string}`,
    chainId: BASE_CHAIN_ID,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, amount],
    }),
    recipient,
    amount,
  };
};

type SendTransactionFn = (
  tx: { to: `0x${string}`; value: `0x${string}`; data: `0x${string}`; chainId?: number },
  options?: { address?: string },
) => Promise<{ hash: string }>;

export const sendBaseUsdcPayment = async ({
  sendTransaction,
  payerAddress,
  recipientAddress,
  amountUsd,
}: {
  sendTransaction: SendTransactionFn;
  payerAddress: string;
  recipientAddress: string;
  amountUsd: number;
}) => {
  if (!payerAddress || !isAddress(payerAddress)) {
    throw new Error('No valid payer wallet address is available.');
  }

  const tx = buildBaseUsdcTransferTx(recipientAddress, amountUsd);
  const result = await sendTransaction(
    {
      to: tx.to,
      value: tx.value,
      data: tx.data,
      chainId: tx.chainId,
    },
    { address: payerAddress },
  );
  return result.hash;
};
