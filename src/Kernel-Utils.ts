import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  SponsorUserOperationParameters,
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { GetKernelVersion } from "@zerodev/sdk/types";
import { EntryPoint } from "permissionless/types/entrypoint";
import { Chain, Hex, Transport, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygonMumbai, sepolia, mainnet } from "viem/chains";

const zeroDevProjectId = process.env.ZERODEV_PROJECT_ID;
const privateKey = process.env.PRIVATE_KEY;
if (!zeroDevProjectId || !privateKey) {
  throw new Error("ZERODEV_PROJECT_ID or PRIVATE_KEY is not set");
}

const signer = privateKeyToAccount(privateKey as Hex);
const chain = mainnet;
const publicClient = createPublicClient({
  transport: http(process.env.BUNDLER_RPC),
});

export const getKernelClient = async <entryPoint extends EntryPoint>(
  entryPointAddress: entryPoint,
  kernelVersion: GetKernelVersion<entryPoint>
) => {
  const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
    signer,
    entryPoint: entryPointAddress,
    kernelVersion
  });

  const account = await createKernelAccount(publicClient, {
    plugins: {
      sudo: ecdsaValidator,
    },
    entryPoint: entryPointAddress,
    kernelVersion
  });
  console.log("My account:", account.address);

  return createKernelAccountClient({
    account,
    entryPoint: entryPointAddress,
    chain,
    bundlerTransport: http(process.env.BUNDLER_RPC),
    middleware: {
      sponsorUserOperation: async ({ userOperation }) => {
        const paymasterClient = createZeroDevPaymasterClient({
          chain,
          transport: http(process.env.PAYMASTER_RPC),
          entryPoint: entryPointAddress,
        });
        const _userOperation =
          userOperation as SponsorUserOperationParameters<entryPoint>["userOperation"];
        return paymasterClient.sponsorUserOperation({
          userOperation: _userOperation,
          entryPoint: entryPointAddress,
        });
      },
    },
  });
};
