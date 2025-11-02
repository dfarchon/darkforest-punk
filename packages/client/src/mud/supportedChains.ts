/*
 * The supported chains.
 * By default, there are only two chains here:
 *
 * - mudFoundry, the chain running on anvil that pnpm dev
 *   starts by default. It is similar to the viem anvil chain
 *   (see https://viem.sh/docs/clients/test.html), but with the
 *   basefee set to zero to avoid transaction fees.
 * - Redstone, our production blockchain (https://redstone.xyz/)
 * - Garnet, our test blockchain (https://garnetchain.com/))
 *
 */

import {
  garnet,
  type MUDChain,
  mudFoundry,
  redstone,
} from "@latticexyz/common/chains";

import {
  baseSepolia as baseSepoliaConfig,
  base as baseConfig,
  optimism as optimismConfig,
} from "viem/chains";

export const baseSepolia = {
  ...baseSepoliaConfig,
  iconUrls: [""],
  indexerUrl: "",
  rpcUrls: {
    ...baseSepoliaConfig.rpcUrls,
    default: {
      http: baseSepoliaConfig.rpcUrls.default.http,
      webSocket: [
        baseSepoliaConfig.rpcUrls.default.http[0].replace("https", "wss"),
      ], // Convert HTTP to WebSocket URL
    },
  },
  blockExplorers: {
    default: {
      name: "Base Sepolia Explorer",
      url: "https://sepolia.basescan.org",
    },
  },
} as MUDChain;

export const base = {
  ...baseConfig,
  iconUrls: [""],
  indexerUrl: "",
  rpcUrls: {
    ...baseConfig.rpcUrls,
    default: {
      http: baseConfig.rpcUrls.default.http,
      webSocket: [baseConfig.rpcUrls.default.http[0].replace("https", "wss")], // Convert HTTP to WebSocket URL
    },
  },
  blockExplorers: {
    default: {
      name: "Base Explorer",
      url: "https://basescan.org",
    },
  },
} as MUDChain;

export const optimism = {
  ...optimismConfig,
  iconUrls: [""],
  indexerUrl: "",
  rpcUrls: {
    ...optimismConfig.rpcUrls,
    default: {
      http: optimismConfig.rpcUrls.default.http,
      webSocket: [
        optimismConfig.rpcUrls.default.http[0].replace("https", "wss"),
      ], // Convert HTTP to WebSocket URL
    },
  },
  blockExplorers: {
    default: {
      name: "Optimism Explorer",
      url: "https://mainnet.optimism.io",
    },
  },
} as MUDChain;

/*
 * See https://mud.dev/guides/hello-world/add-chain-client
 * for instructions on how to add networks.
 */
export const supportedChains: MUDChain[] = [
  mudFoundry,
  redstone,
  garnet,
  baseSepolia,
  base,
  optimism,
];
