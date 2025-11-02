import { formatUnits } from "ethers/lib/utils";

// smallDec represents the decimals to show for small numbers
export const formatNumber = (num: number, smallDec = 0): string => {
  if (num < 1000) {
    if (`${num}` === num.toFixed(0)) {
      return `${num.toFixed(0)}`;
    } else {
      return `${num.toFixed(smallDec)}`;
    }
  }

  const suffixes = ["", "K", "M", "B", "T", "q", "Q"];
  let log000 = 0;
  let rem = num;
  while (rem / 1000 >= 1) {
    rem /= 1000;
    log000++;
  }

  if (log000 === 0) {
    return `${Math.floor(num)}`;
  }

  if (rem < 10) {
    return `${rem.toFixed(1)}${suffixes[log000]}`;
  } else if (rem < 100) {
    return `${rem.toFixed(1)}${suffixes[log000]}`;
  } else if (log000 < suffixes.length) {
    return `${rem.toFixed(0)}${suffixes[log000]}`;
  } else {
    return `${rem.toFixed(0)}E${log000 * 3}`;
  }
};

export function formatEtherToNumber(
  value: string | bigint | number,
  decimals = 18,
): number {
  try {
    return parseFloat(formatUnits(value.toString(), decimals));
  } catch {
    return 0;
  }
}

export function formatCompact(num: number): string {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 0,
  }).format(num);
}
export function formatCompact2(num: number): string {
  return Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(num);
}
