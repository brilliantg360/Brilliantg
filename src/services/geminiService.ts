import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Cache to reduce API calls
const cache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 429 || error?.code === 429;
    if (isRateLimit && retries > 0) {
      console.warn(`Rate limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export interface MarketSignal {
  pair: string;
  action: 'BUY' | 'SELL' | 'NEUTRAL';
  strategy: 'CONFIRMATION' | 'BREAKOUT' | 'REVERSAL' | 'NONE';
  confidence: number;
  reasoning: string;
  verdict: string;
  setup: string;
  currentPrice: number;
  changePercent: number;
  history: { time: string; price: number }[];
  entryPrice: string;
  takeProfit: string;
  stopLoss: string;
  tpPips: number;
  slPips: number;
  trend: 'UP' | 'DOWN' | 'SIDEWAYS';
  confirmationPrice?: string;
  liquidityAreas?: { top: number; bottom: number; type: 'SUPPLY' | 'DEMAND' }[];
}

export interface BacktestResult {
  pair: string;
  startDate: string;
  endDate: string;
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  trades: {
    date: string;
    type: 'BUY' | 'SELL';
    entry: number;
    exit: number;
    result: 'WIN' | 'LOSS';
    profit: number;
    reason: string;
  }[];
  summary: string;
}

export interface EconomicEvent {
  id: string;
  time: string;
  currency: string;
  country: string;
  event: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  actual: string;
  forecast: string;
  previous: string;
}

export async function getForexAnalysis(pair: string, confirmationSignal: boolean = false): Promise<MarketSignal> {
  const cacheKey = `analysis-${pair}-${confirmationSignal}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const prompt = `Analyze the current market trend for the Forex pair ${pair}. 
  Use Google Search to find the ABSOLUTE LATEST real-time market price and the last 10-15 hourly closing prices.
  
  ${confirmationSignal ? 'PRIORITIZE signals that have multiple confirming indicators (e.g., RSI divergence + Trendline break + Fibonacci confluence). Only provide a BUY or SELL signal if there is a strong confluence of factors. If no strong confluence exists, return NEUTRAL.' : 'Provide a trading signal (BUY, SELL, or NEUTRAL) based on current market sentiment, technical indicators, and recent economic news.'}
  
  Include in your JSON response:
  1. Action (BUY/SELL/NEUTRAL)
  2. Strategy Type (${confirmationSignal ? 'MUST be CONFIRMATION if a signal is given' : 'CONFIRMATION, BREAKOUT, or REVERSAL'})
  3. Confidence level (0-100)
  4. Detailed reasoning
  5. verdict (A punchy, 1-sentence active recommendation, e.g., "Strong Buy on bullish engulfing at support")
  6. setup (A brief summary of the trade setup, e.g., "Wait for 1.0850 retest then target 1.0920")
  7. currentPrice (The exact latest market price as a number)
  6. changePercent (The 24h percentage change as a number)
  7. history (An array of objects with "time" and "price" for the last 10-15 data points)
  7. Suggested Entry Price
  8. Suggested Take Profit (Price)
  9. Suggested Stop Loss (Price)
  10. Take Profit distance in Pips (Number)
  11. Stop Loss distance in Pips (Number)
  12. Overall Trend (UP/DOWN/SIDEWAYS)
  13. Suggested Confirmation Price (Price level where the trade is fully validated)
  14. Liquidity Areas (Array of objects with "top", "bottom", and "type" (SUPPLY/DEMAND) for key zones)
  
  Return the response in JSON format.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    }));

    let text = response.text || "{}";
    // Remove markdown code blocks if present
    text = text.replace(/```json\n?|```/g, "").trim();
    
    const result = JSON.parse(text);
    const finalResult = {
      pair,
      action: result.action || 'NEUTRAL',
      strategy: result.strategy || 'NONE',
      confidence: result.confidence || 50,
      reasoning: result.reasoning || "Insufficient data for analysis.",
      verdict: result.verdict || "No clear recommendation at this time.",
      setup: result.setup || "Monitor price action for a clearer entry signal.",
      currentPrice: result.currentPrice || 0,
      changePercent: result.changePercent || 0,
      history: result.history || [],
      entryPrice: result.entryPrice || "N/A",
      takeProfit: result.takeProfit || "N/A",
      stopLoss: result.stopLoss || "N/A",
      tpPips: result.tpPips || 0,
      slPips: result.slPips || 0,
      trend: result.trend || 'SIDEWAYS',
      confirmationPrice: result.confirmationPrice || "N/A",
      liquidityAreas: result.liquidityAreas || [],
    };

    cache[cacheKey] = { data: finalResult, timestamp: Date.now() };
    return finalResult;
  } catch (error) {
    console.error("Error fetching Forex analysis:", error);
    return {
      pair,
      action: 'NEUTRAL',
      strategy: 'NONE',
      confidence: 0,
      reasoning: "Error connecting to analysis engine.",
      verdict: "Analysis Unavailable",
      setup: "Please try refreshing the data.",
      currentPrice: 0,
      changePercent: 0,
      history: [],
      entryPrice: "N/A",
      takeProfit: "N/A",
      stopLoss: "N/A",
      tpPips: 0,
      slPips: 0,
      trend: 'SIDEWAYS',
    };
  }
}

export async function getMarketNews() {
  const cacheKey = 'market-news';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const prompt = "Provide the top 5 most important Forex and global economic news headlines for today that could impact currency markets. Include a brief summary of why each matters.";
  
  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    }));
    cache[cacheKey] = { data: response.text, timestamp: Date.now() };
    return response.text;
  } catch (error) {
    return "Unable to fetch market news at this time.";
  }
}

export async function backtestForex(
  pair: string, 
  startDate: string, 
  endDate: string, 
  initialBalance: number,
  riskPerTrade: number
): Promise<BacktestResult> {
  const prompt = `Perform a detailed Forex backtest for the pair ${pair} from ${startDate} to ${endDate}.
  
  1. Use Google Search to find significant price movements and economic events during this specific period.
  2. Simulate a series of 5-8 high-probability trades that the TrendPulse AI would have taken based on technical and fundamental analysis of that time.
  3. For each trade, specify:
     - Date
     - Type (BUY/SELL)
     - Entry Price
     - Exit Price (based on a realistic Take Profit or Stop Loss)
     - Result (WIN/LOSS)
     - A brief reason for the trade.
  4. Calculate the financial outcome starting with a balance of ${initialBalance} and risking ${riskPerTrade}% per trade.
  5. Provide a summary of the overall performance and risk management effectiveness.
  
  Return the response in JSON format matching this structure:
  {
    "pair": "${pair}",
    "startDate": "${startDate}",
    "endDate": "${endDate}",
    "initialBalance": ${initialBalance},
    "finalBalance": number,
    "totalTrades": number,
    "winRate": number (percentage),
    "profitFactor": number,
    "trades": [
      { "date": "string", "type": "BUY"|"SELL", "entry": number, "exit": number, "result": "WIN"|"LOSS", "profit": number, "reason": "string" }
    ],
    "summary": "string"
  }`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    });

    let text = response.text || "{}";
    text = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(text);
  } catch (error) {
    console.error("Backtest Error:", error);
    throw error;
  }
}

export async function getEconomicCalendar(): Promise<EconomicEvent[]> {
  const cacheKey = 'economic-calendar';
  if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_TTL) {
    return cache[cacheKey].data;
  }

  const prompt = `Provide a list of the top 10 most important upcoming economic events for the next 7 days that will impact major Forex pairs.
  
  Use Google Search to find the latest real-time economic calendar data.
  
  For each event, include:
  1. Time (ISO format or clear string)
  2. Currency (e.g., USD, EUR, GBP)
  3. Country (e.g., United States, Eurozone, United Kingdom)
  4. Event Name (e.g., Non-Farm Payrolls, CPI, Interest Rate Decision)
  5. Impact (HIGH, MEDIUM, or LOW)
  6. Actual (if already released, otherwise "N/A")
  7. Forecast (expected value)
  8. Previous (last period's value)
  
  Return the response in JSON format as an array of objects.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    }));

    let text = response.text || "[]";
    text = text.replace(/```json\n?|```/g, "").trim();
    const events = JSON.parse(text);
    
    const finalEvents = events.map((e: any, index: number) => ({
      id: e.id || `event-${index}`,
      time: e.time || "N/A",
      currency: e.currency || "N/A",
      country: e.country || "N/A",
      event: e.event || "N/A",
      impact: e.impact || "LOW",
      actual: e.actual || "N/A",
      forecast: e.forecast || "N/A",
      previous: e.previous || "N/A",
    }));

    cache[cacheKey] = { data: finalEvents, timestamp: Date.now() };
    return finalEvents;
  } catch (error) {
    console.error("Economic Calendar Error:", error);
    return [];
  }
}
