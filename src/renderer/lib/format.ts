export const formatNumber = (
  value: number,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
) => {
  const n = Number(value)
  const min = options?.minimumFractionDigits
  const max = options?.maximumFractionDigits
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
}

export const formatMoney = (value: number, currencySymbol: string = '¥') => {
  return `${currencySymbol}${formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const formatMoneyInt = (value: number, currencySymbol: string = '¥') => {
  return `${currencySymbol}${formatNumber(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export const formatPercent = (value: number) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0.0%'
  return `${n.toFixed(1)}%`
}

export const formatAmountShort = (amount: number) => {
  const n = Number(amount || 0)
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 100000000) return `${sign}${(abs / 100000000).toFixed(1)}亿`
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}w`
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`
  return `${sign}${Math.round(abs)}`
}

