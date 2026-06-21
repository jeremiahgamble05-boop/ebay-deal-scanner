import { useEffect, useRef, useState } from 'react';
import { Deal } from '@workspace/api-client-react';

export function useDealWebsocket() {
  const [liveDeals, setLiveDeals] = useState<Deal[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = wsProtocol + '//' + window.location.host + '/api/v1/ws/deals';

    const connect = () => {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          // Filter out control messages (e.g. { type: "connected" })
          if (!msg || typeof msg.id === 'undefined' || typeof msg.title === 'undefined') return;
          const deal = msg as Deal;
          setLiveDeals((prev) => {
            const exists = prev.some(d => d.id === deal.id);
            if (exists) return prev;
            return [deal, ...prev].slice(0, 100); // Keep last 100
          });
        } catch (err) {
          console.error('Failed to parse websocket message', err);
        }
      };

      wsRef.current.onclose = () => {
        // Reconnect after a delay
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return liveDeals;
}
