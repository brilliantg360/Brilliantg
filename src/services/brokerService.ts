export interface OandaAccountSummary {
  balance: string;
  openTradeCount: number;
  pl: string;
  equity: string;
  marginUsed: string;
  currency: string;
}

export interface OandaPosition {
  instrument: string;
  long: { units: string; pl: string };
  short: { units: string; pl: string };
}

const getBaseUrl = () => {
  const env = process.env.OANDA_ENV || 'practice';
  return env === 'live' 
    ? 'https://api-fxtrade.oanda.com/v3' 
    : 'https://api-fxpractice.oanda.com/v3';
};

export async function getOandaAccountSummary(): Promise<OandaAccountSummary | null> {
  const apiKey = process.env.OANDA_API_KEY;
  const accountId = process.env.OANDA_ACCOUNT_ID;

  if (!apiKey || !accountId) return null;

  try {
    const response = await fetch(`${getBaseUrl()}/accounts/${accountId}/summary`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch OANDA summary');
    const data = await response.json();
    return {
      balance: data.account.balance,
      openTradeCount: data.account.openTradeCount,
      pl: data.account.pl,
      equity: data.account.NAV,
      marginUsed: data.account.marginUsed,
      currency: data.account.currency
    };
  } catch (error) {
    console.error('OANDA Error:', error);
    return null;
  }
}

export async function getOandaPositions(): Promise<OandaPosition[]> {
  const apiKey = process.env.OANDA_API_KEY;
  const accountId = process.env.OANDA_ACCOUNT_ID;

  if (!apiKey || !accountId) return [];

  try {
    const response = await fetch(`${getBaseUrl()}/accounts/${accountId}/positions`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error('Failed to fetch OANDA positions');
    const data = await response.json();
    return data.positions || [];
  } catch (error) {
    console.error('OANDA Error:', error);
    return [];
  }
}
