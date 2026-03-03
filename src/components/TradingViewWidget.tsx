import React, { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
}

export default function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    if (!container.current) return;

    const containerRef = container.current;
    containerRef.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    // Convert pair format (EUR/USD -> FX:EURUSD)
    const formattedSymbol = `FX:${symbol.replace('/', '')}`;

    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": formattedSymbol,
      "interval": "60",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "enable_publishing": false,
      "hide_top_toolbar": false,
      "allow_symbol_change": true,
      "save_image": false,
      "container_id": "tradingview_chart",
      "studies": [
        "RSI@tv-basicstudies",
        "MASimple@tv-basicstudies"
      ],
      "show_popup_button": true,
      "popup_width": "1000",
      "popup_height": "650",
      "support_host": "https://www.tradingview.com"
    });

    try {
      if (isMounted) {
        containerRef.appendChild(script);
      }
    } catch (e) {
      console.error("TradingView script injection error:", e);
    }

    return () => {
      isMounted = false;
      if (containerRef) {
        containerRef.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={container}>
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}
