import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Currency formatting utilities
export function formatUSD(amount: number | null | undefined): string {
  return `$${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatLBP(amount: number | null | undefined): string {
  return `${(amount || 0).toLocaleString('en-US')} LBP`;
}
