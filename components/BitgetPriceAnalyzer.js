"use client";
import React, { useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, Activity, AlertCircle, Zap } from "lucide-react";

const BitgetPriceMomentumAnalyzer = () => {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChanges, setPriceChanges] = useState([]);
  const [momentum, setMomentum] = useState(0);
  const [trendStrength, setTrendStrength] = useState(0);
  const [acceleration, setAcceleration] = useState(0);
  const [signal, setSignal] = useState({ type: "NEUTRAL", score: 0 });
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ totalChange: 0, maxUp: 0, maxDown: 0 });
  const [symbol] = useState("ETHUSDT");

  const ws = useRef(null);
  const priceHistory = useRef([]);
  const lastPrice = useRef(0);
  const lastUpdate = useRef(Date.now());

  useEffect(() => {
    connectWebSocket();
    const interval = setInterval(analyzeAndDisplay, 1000); // 1초마다 분석

    return () => {
      clearInterval(interval);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    ws.current = new WebSocket("wss://ws.bitget.com/mix/v1/stream");

    ws.current.onopen = () => {
      setConnected(true);

      // 실시간 가격 구독
      ws.current.send(
        JSON.stringify({
          op: "subscribe",
          args: [
            {
              instType: "mc",
              channel: "ticker",
              instId: symbol,
            },
          ],
        })
      );

      // 거래 데이터 구독
      ws.current.send(
        JSON.stringify({
          op: "subscribe",
          args: [
            {
              instType: "mc",
              channel: "trade",
              instId: symbol,
            },
          ],
        })
      );
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.data) {
        if (data.arg?.channel === "ticker") {
          updatePriceFromTicker(data.data[0]);
        } else if (data.arg?.channel === "trade") {
          updatePriceFromTrades(data.data);
        }
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnected(false);
    };

    ws.current.onclose = () => {
      setConnected(false);
      setTimeout(connectWebSocket, 5000);
    };
  };

  const updatePriceFromTicker = (ticker) => {
    const newPrice = parseFloat(ticker.last);
    if (newPrice > 0) {
      recordPriceChange(newPrice);
    }
  };

  const updatePriceFromTrades = (trades) => {
    trades.forEach((trade) => {
      const price = parseFloat(trade.px);
      recordPriceChange(price);
    });
  };

  const recordPriceChange = (newPrice) => {
    if (!newPrice || newPrice <= 0) return; // 유효하지 않은 가격 무시

    if (lastPrice.current === 0) {
      lastPrice.current = newPrice;
      setCurrentPrice(newPrice);
      return;
    }

    const priceChange = newPrice - lastPrice.current;

    if (priceChange !== 0) {
      const now = Date.now();
      const changeRecord = {
        time: now,
        price: newPrice,
        change: priceChange,
        timestamp: new Date().toLocaleTimeString(),
      };

      priceHistory.current.push(changeRecord);

      // 최근 30초 데이터만 유지
      const thirtySecondsAgo = now - 30000;
      priceHistory.current = priceHistory.current.filter((p) => p.time > thirtySecondsAgo);

      lastPrice.current = newPrice;
      setCurrentPrice(newPrice);
    }
  };

  const analyzeAndDisplay = () => {
    const now = Date.now();
    if (now - lastUpdate.current < 1000) return; // 1초 간격 체크

    lastUpdate.current = now;

    // 최근 15개 변화 표시
    const recentChanges = priceHistory.current.slice(-15);
    setPriceChanges(recentChanges);

    // 모멘텀 분석
    if (priceHistory.current.length >= 3) {
      analyzeMomentum();
    }
  };

  const analyzeMomentum = () => {
    const recent = priceHistory.current.slice(-20); // 최근 10초

    if (recent.length === 0) return;

    // 시간 가중 모멘텀
    let weightedChange = 0;
    let totalChange = 0;

    recent.forEach((change, i) => {
      const weight = (i + 1) / recent.length;
      weightedChange += change.change * weight;
      totalChange += change.change;
    });

    const momentumScore = Math.min(100, Math.max(-100, weightedChange * 100));
    setMomentum(momentumScore);

    // 추세 강도 (연속적인 상승/하락)
    let consecutive = 0;
    let lastDirection = null;

    recent.slice(-10).forEach((change) => {
      const direction = change.change > 0 ? 1 : change.change < 0 ? -1 : 0;

      if (direction !== 0) {
        if (lastDirection === direction) {
          consecutive++;
        } else {
          consecutive = 1;
        }
        lastDirection = direction;
      }
    });

    setTrendStrength(consecutive * (lastDirection || 0));

    // 가속도
    if (recent.length >= 5) {
      const firstHalf = recent.slice(0, recent.length / 2);
      const secondHalf = recent.slice(recent.length / 2);

      const firstAvg = firstHalf.reduce((sum, c) => sum + c.change, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, c) => sum + c.change, 0) / secondHalf.length;

      setAcceleration((secondAvg - firstAvg) * 100);
    }

    // 통계
    if (recent.length > 0) {
      const changes = recent.map((c) => c.change);
      const maxUp = Math.max(...changes, 0);
      const maxDown = Math.min(...changes, 0);
      setStats({ totalChange, maxUp, maxDown });
    }

    // 신호 생성
    const score = momentumScore + consecutive * 10 + acceleration * 0.5;

    let signalType = "NEUTRAL";
    if (score > 50) signalType = "STRONG_UP";
    else if (score > 20) signalType = "UP";
    else if (score < -50) signalType = "STRONG_DOWN";
    else if (score < -20) signalType = "DOWN";

    setSignal({ type: signalType, score });
  };

  const getSignalColor = (type) => {
    switch (type) {
      case "STRONG_UP":
        return "bg-green-500 text-white";
      case "UP":
        return "bg-green-400 text-white";
      case "STRONG_DOWN":
        return "bg-red-500 text-white";
      case "DOWN":
        return "bg-red-400 text-white";
      default:
        return "bg-yellow-500 text-white";
    }
  };

  const getChangeBar = (change) => {
    const maxWidth = 200;
    const width = Math.min(Math.abs(change) * 50, maxWidth);

    if (change > 0) {
      return (
        <div className="flex items-center">
          <span className="w-20 text-right text-green-400">+${change.toFixed(2)}</span>
          <div className="ml-2 h-4 bg-green-500 transition-all duration-300" style={{ width: `${width}px` }} />
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center">
          <span className="w-20 text-right text-red-400">-${Math.abs(change).toFixed(2)}</span>
          <div className="ml-2 h-4 bg-red-500 transition-all duration-300" style={{ width: `${width}px` }} />
        </div>
      );
    } else {
      return (
        <div className="flex items-center">
          <span className="w-20 text-right text-gray-400">$0.00</span>
          <div className="ml-2 h-4 bg-gray-600 w-1" />
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Price Momentum Analyzer</h1>
          <div className="flex items-center gap-4">
            <span className="text-xl">{symbol}</span>
            <span className="text-2xl font-mono">${currentPrice > 0 ? currentPrice.toFixed(2) : "---"}</span>
            <span className={`text-sm ${connected ? "text-green-500" : "text-red-500"}`}>{connected ? "● Connected" : "● Disconnected"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 실시간 가격 변화 */}
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Real-time Price Changes (1s intervals)
            </h2>
            <div className="space-y-1">
              {priceChanges.map((change, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-sm text-gray-400 w-20">{change.timestamp}</span>
                  {getChangeBar(change.change)}
                </div>
              ))}
              {priceChanges.length === 0 && <div className="text-gray-500 text-center py-8">Waiting for price changes...</div>}
            </div>
          </div>

          {/* 분석 패널 */}
          <div className="space-y-4">
            {/* 모멘텀 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Momentum</h3>
              <div className="text-3xl font-bold text-center">
                <span className={momentum > 0 ? "text-green-400" : "text-red-400"}>
                  {momentum > 0 ? "+" : ""}
                  {momentum.toFixed(1)}
                </span>
              </div>
              <div className="text-sm text-gray-400 text-center">Time-weighted score</div>
            </div>

            {/* 추세 강도 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2">Trend Strength</h3>
              <div className="flex items-center justify-center gap-2">
                {trendStrength > 0 ? (
                  <TrendingUp className="w-8 h-8 text-green-400" />
                ) : trendStrength < 0 ? (
                  <TrendingDown className="w-8 h-8 text-red-400" />
                ) : (
                  <Activity className="w-8 h-8 text-gray-400" />
                )}
                <span className="text-2xl font-bold">{Math.abs(trendStrength)}</span>
              </div>
              <div className="text-sm text-gray-400 text-center">Consecutive moves</div>
            </div>

            {/* 가속도 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Acceleration
              </h3>
              <div className={`text-2xl font-bold text-center ${acceleration > 0 ? "text-green-400" : "text-red-400"}`}>
                {acceleration > 0 ? "+" : ""}
                {acceleration.toFixed(1)}
              </div>
              <div className="text-sm text-gray-400 text-center">Rate of change</div>
            </div>
          </div>
        </div>

        {/* 신호 및 통계 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* 트레이딩 신호 */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Trading Signal</h2>
            <div className={`text-center p-4 rounded-lg ${getSignalColor(signal.type)}`}>
              <div className="text-3xl font-bold mb-2">{signal.type.replace("_", " ")}</div>
              <div className="text-sm opacity-90">Score: {signal.score.toFixed(1)}</div>
            </div>
            <div className="mt-4 text-sm">
              {signal.type === "STRONG_UP" && <p className="text-green-400">🚀 강한 상승 압력! 빠른 가격 상승 중</p>}
              {signal.type === "UP" && <p className="text-green-300">📈 상승 압력 감지. 점진적 상승</p>}
              {signal.type === "STRONG_DOWN" && <p className="text-red-400">⚠️ 강한 하락 압력! 빠른 가격 하락 중</p>}
              {signal.type === "DOWN" && <p className="text-red-300">📉 하락 압력 감지. 점진적 하락</p>}
              {signal.type === "NEUTRAL" && <p className="text-yellow-400">➖ 횡보 중. 방향성 불분명</p>}
            </div>
          </div>

          {/* 10초 통계 */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-semibold mb-4">Last 10s Statistics</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Change:</span>
                <span className={stats.totalChange > 0 ? "text-green-400" : "text-red-400"}>${stats.totalChange.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Up:</span>
                <span className="text-green-400">${stats.maxUp.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Max Down:</span>
                <span className="text-red-400">${stats.maxDown.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 강한 신호 알림 */}
        {(signal.type === "STRONG_UP" || signal.type === "STRONG_DOWN") && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${signal.type === "STRONG_UP" ? "bg-green-600" : "bg-red-600"} flex items-center gap-2 animate-pulse`}>
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">{signal.type === "STRONG_UP" ? "강한 상승 압력 감지!" : "강한 하락 압력 감지!"}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default BitgetPriceMomentumAnalyzer;
