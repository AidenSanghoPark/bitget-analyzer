"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { TrendingUp, TrendingDown, Activity, AlertCircle, Zap, ChevronDown } from "lucide-react";

const BitgetPriceMomentumAnalyzer = () => {
  const [currentPrice, setCurrentPrice] = useState(0);
  const [priceChange1s, setPriceChange1s] = useState(0);
  const [priceChanges, setPriceChanges] = useState([]);
  const [momentum, setMomentum] = useState(0);
  const [trendStrength, setTrendStrength] = useState(0);
  const [acceleration, setAcceleration] = useState(0);
  const [signal, setSignal] = useState({ type: "NEUTRAL", score: 0 });
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ totalChange: 0, maxUp: 0, maxDown: 0 });
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSymbols, setFilteredSymbols] = useState([]);
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [rawApiData, setRawApiData] = useState(null);
  const [updateSpeed, setUpdateSpeed] = useState(500); // 기본 0.5초

  const [symbols, setSymbols] = useState([
    { value: "BTCUSDT", label: "비트코인 (BTC)", icon: "₿" },
    { value: "ETHUSDT", label: "이더리움 (ETH)", icon: "Ξ" },
  ]);
  const [isLoadingSymbols, setIsLoadingSymbols] = useState(false);

  // 업데이트 속도에 따른 제목 생성
  const getSpeedTitle = () => {
    const speedMap = {
      100: "Real-time Price Changes (0.1s intervals) ⚡",
      250: "Real-time Price Changes (0.25s intervals) 🔥",
      500: "Real-time Price Changes (0.5s intervals) 🚀",
      1000: "Real-time Price Changes (1s intervals) 📊",
      2000: "Real-time Price Changes (2s intervals) 🐌",
      5000: "Real-time Price Changes (5s intervals) 🔄",
    };
    return speedMap[updateSpeed] || `Real-time Price Changes (${updateSpeed}ms intervals)`;
  };
  const addDebugLog = (type, data) => {
    if (!debugMode) return;

    const logEntry = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      type: type,
      data: data,
    };

    setDebugLogs((prev) => [logEntry, ...prev.slice(0, 19)]); // 최대 20개 로그
  };
  const getCoinIcon = (symbol) => {
    const iconMap = {
      BTC: "₿",
      ETH: "Ξ",
      ADA: "₳",
      LTC: "Ł",
      XRP: "✕",
      DOT: "●",
      LINK: "🔗",
      UNI: "🦄",
      MATIC: "◆",
      SOL: "◎",
      AVAX: "▲",
      ATOM: "⚛",
      FTM: "👻",
      NEAR: "🌐",
      ALGO: "△",
    };

    const coinName = symbol.replace("USDT", "").replace("BUSD", "").replace("USDC", "");
    return iconMap[coinName] || "🪙";
  };

  // 코인 한글명 매핑
  const getCoinKoreanName = (symbol) => {
    if (!symbol || typeof symbol !== "string") return "Unknown";

    const nameMap = {
      BTCUSDT: "비트코인",
      ETHUSDT: "이더리움",
      ADAUSDT: "에이다",
      LTCUSDT: "라이트코인",
      XRPUSDT: "리플",
      DOTUSDT: "폴카닷",
      LINKUSDT: "체인링크",
      UNIUSDT: "유니스왑",
      MATICUSDT: "폴리곤",
      SOLUSDT: "솔라나",
      AVAXUSDT: "아발란체",
      ATOMUSDT: "코스모스",
      FTMUSDT: "팬텀",
      NEARUSDT: "니어",
      ALGOUSDT: "알고랜드",
    };

    const coinName = symbol.replace("USDT", "").replace("BUSD", "").replace("USDC", "");
    return nameMap[symbol] || coinName;
  };

  // API에서 코인 목록 가져오기
  const fetchAvailableSymbols = async () => {
    setIsLoadingSymbols(true);
    addDebugLog("API_REQUEST", "Bitget V2 API 호출 시작");

    try {
      const response = await fetch("https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES");
      const data = await response.json();

      addDebugLog("API_RESPONSE", {
        status: response.status,
        code: data.code,
        dataLength: data.data?.length || 0,
        firstItem: data.data?.[0] || null,
      });

      setRawApiData(data); // 원본 데이터 저장

      if (data.code === "00000" && data.data) {
        // V2 API는 이미 USDT 선물만 반환하므로 추가 필터링 불필요
        const allSymbols = data.data
          .filter((item) => item && item.symbol && item.baseCoin) // null 체크 추가
          .map((item) => ({
            value: item.symbol,
            label: `${getCoinKoreanName(item.symbol)} (${item.baseCoin})`,
            icon: getCoinIcon(item.symbol),
            baseCoin: item.baseCoin,
            searchText: `${item.baseCoin} ${getCoinKoreanName(item.symbol)} ${item.symbol}`.toLowerCase(),
            rawData: item, // 원본 데이터도 포함
          }))
          .sort((a, b) => {
            // 인기 코인들을 앞에, 나머지는 알파벳 순
            const popularOrder = ["BTC", "ETH", "ADA", "LTC", "XRP", "DOT", "LINK", "UNI", "MATIC", "SOL", "AVAX", "ATOM"];
            const aIndex = popularOrder.indexOf(a.baseCoin);
            const bIndex = popularOrder.indexOf(b.baseCoin);

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            return a.baseCoin.localeCompare(b.baseCoin);
          });

        setSymbols(allSymbols);
        setFilteredSymbols(allSymbols);
        addDebugLog("SYMBOLS_PROCESSED", `${allSymbols.length}개 코인 처리 완료`);
      }
    } catch (error) {
      console.error("코인 목록을 가져오는데 실패했습니다:", error);
      addDebugLog("API_ERROR", error.message);
      // 실패시 기본값 유지
    } finally {
      setIsLoadingSymbols(false);
    }
  };

  // 검색 필터링
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSymbols(symbols);
    } else {
      const filtered = symbols.filter((symbol) => symbol.searchText && symbol.searchText.includes(searchTerm.toLowerCase()));
      setFilteredSymbols(filtered);
    }
  }, [searchTerm, symbols]);

  // 컴포넌트 마운트시 코인 목록 가져오기
  useEffect(() => {
    fetchAvailableSymbols();
  }, []);

  const ws = useRef(null);
  const reconnectTimeout = useRef(null);
  const pingInterval = useRef(null);
  const priceHistory = useRef([]);
  const lastPrice = useRef(0);
  const lastUpdate = useRef(Date.now());

  const recordPriceChange = (newPrice) => {
    addDebugLog("PRICE_RECORD_ATTEMPT", { newPrice, lastPrice: lastPrice.current });

    if (!newPrice || newPrice <= 0) {
      addDebugLog("PRICE_RECORD_ERROR", "유효하지 않은 가격");
      return;
    }

    if (lastPrice.current === 0) {
      lastPrice.current = newPrice;
      setCurrentPrice(newPrice);
      addDebugLog("PRICE_RECORD_INIT", `초기 가격 설정: ${newPrice}`);
      return;
    }

    const priceChange = newPrice - lastPrice.current;

    // 가격 데이터만 저장하고, 화면 업데이트는 analyzeAndDisplay에서 처리
    if (priceChange !== 0) {
      const now = Date.now();
      const changeRecord = {
        time: now,
        price: newPrice,
        change: priceChange,
        timestamp: new Date().toLocaleTimeString(),
      };

      priceHistory.current.push(changeRecord);
      addDebugLog("PRICE_CHANGE_RECORDED", {
        change: priceChange,
        newPrice: newPrice,
        historyLength: priceHistory.current.length,
      });

      const thirtySecondsAgo = now - 30000;
      priceHistory.current = priceHistory.current.filter((p) => p.time > thirtySecondsAgo);

      lastPrice.current = newPrice;
    } else {
      addDebugLog("PRICE_NO_CHANGE", "가격 변화 없음");
      lastPrice.current = newPrice; // 가격이 같아도 업데이트
    }
  };

  const updatePriceFromTicker = (ticker) => {
    if (!ticker) {
      addDebugLog("TICKER_ERROR", "ticker 데이터가 null입니다");
      return;
    }

    // V2 API에서는 'last' 대신 다른 필드명을 사용할 수 있음
    const price = parseFloat(ticker.last || ticker.lastPr || ticker.price || ticker.close);
    addDebugLog("TICKER_PRICE_PARSE", {
      rawTicker: ticker,
      parsedPrice: price,
      availableFields: Object.keys(ticker),
    });

    if (price > 0) {
      recordPriceChange(price);
    } else {
      addDebugLog("TICKER_ERROR", `가격 파싱 실패: ${JSON.stringify(ticker)}`);
    }
  };

  const updatePriceFromTrades = (trades) => {
    if (!trades || !Array.isArray(trades)) {
      addDebugLog("TRADE_ERROR", "trades 데이터가 배열이 아닙니다");
      return;
    }

    trades.forEach((trade, index) => {
      // V2 API에서는 'px' 대신 다른 필드명을 사용할 수 있음
      const price = parseFloat(trade.px || trade.price || trade.fillPrice);
      addDebugLog("TRADE_PRICE_PARSE", {
        tradeIndex: index,
        rawTrade: trade,
        parsedPrice: price,
        availableFields: Object.keys(trade),
      });

      if (price > 0) {
        recordPriceChange(price);
      }
    });
  };

  const analyzeMomentum = useCallback(() => {
    const recent = priceHistory.current.slice(-20);

    if (recent.length === 0) return;

    let weightedChange = 0;
    let totalChange = 0;

    recent.forEach((change, i) => {
      const weight = (i + 1) / recent.length;
      weightedChange += change.change * weight;
      totalChange += change.change;
    });

    const momentumScore = Math.min(100, Math.max(-100, weightedChange * 100));
    setMomentum(momentumScore);

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

    if (recent.length >= 5) {
      const firstHalf = recent.slice(0, recent.length / 2);
      const secondHalf = recent.slice(recent.length / 2);

      const firstAvg = firstHalf.reduce((sum, c) => sum + c.change, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, c) => sum + c.change, 0) / secondHalf.length;

      setAcceleration((secondAvg - firstAvg) * 100);
    }

    if (recent.length > 0) {
      const changes = recent.map((c) => c.change);
      const maxUp = Math.max(...changes, 0);
      const maxDown = Math.min(...changes, 0);
      setStats({ totalChange, maxUp, maxDown });
    }

    const score = momentumScore + consecutive * 10 + acceleration * 0.5;

    let signalType = "NEUTRAL";
    if (score > 50) signalType = "STRONG_UP";
    else if (score > 20) signalType = "UP";
    else if (score < -50) signalType = "STRONG_DOWN";
    else if (score < -20) signalType = "DOWN";

    setSignal({ type: signalType, score });
  }, []);

  const connectWebSocket = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.close();
    }

    // 심볼 변경 시 데이터 초기화
    priceHistory.current = [];
    lastPrice.current = 0;
    setCurrentPrice(0);
    setPriceChange1s(0);
    setPriceChanges([]);
    setMomentum(0);
    setTrendStrength(0);
    setAcceleration(0);
    setSignal({ type: "NEUTRAL", score: 0 });
    setStats({ totalChange: 0, maxUp: 0, maxDown: 0 });

    ws.current = new WebSocket("wss://ws.bitget.com/v2/ws/public");

    ws.current.onopen = () => {
      console.log("WebSocket connected");
      setConnected(true);
      addDebugLog("WEBSOCKET", "웹소켓 연결 성공");

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      pingInterval.current = setInterval(() => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send("ping");
          addDebugLog("WEBSOCKET", "Ping 전송");
        }
      }, 30000);

      if (ws.current.readyState === WebSocket.OPEN) {
        const tickerSubscription = {
          op: "subscribe",
          args: [
            {
              instType: "USDT-FUTURES",
              channel: "ticker",
              instId: symbol,
            },
          ],
        };

        const tradeSubscription = {
          op: "subscribe",
          args: [
            {
              instType: "USDT-FUTURES",
              channel: "trade",
              instId: symbol,
            },
          ],
        };

        ws.current.send(JSON.stringify(tickerSubscription));
        ws.current.send(JSON.stringify(tradeSubscription));

        addDebugLog("WEBSOCKET_SUBSCRIBE", {
          symbol: symbol,
          subscriptions: ["ticker", "trade"],
          instType: "USDT-FUTURES",
        });
      }
    };

    ws.current.onmessage = (event) => {
      try {
        if (event.data === "pong") {
          addDebugLog("WEBSOCKET", "Pong 받음");
          return;
        }

        const data = JSON.parse(event.data);
        addDebugLog("WEBSOCKET_DATA_RAW", data);

        // V2 API 응답 구조 분석
        if (data.action && data.data) {
          addDebugLog("WEBSOCKET_DATA_STRUCTURED", {
            action: data.action,
            arg: data.arg,
            dataLength: data.data.length,
            firstDataItem: data.data[0],
          });

          if (data.arg?.channel === "ticker") {
            addDebugLog("TICKER_DATA", data.data[0]);
            updatePriceFromTicker(data.data[0]);
          } else if (data.arg?.channel === "trade") {
            addDebugLog("TRADE_DATA", data.data);
            updatePriceFromTrades(data.data);
          }
        } else if (data.event) {
          // 구독 확인 또는 에러 메시지
          addDebugLog("WEBSOCKET_EVENT", data);
        } else {
          addDebugLog("WEBSOCKET_UNKNOWN", "알 수 없는 메시지 형식");
        }
      } catch (error) {
        console.error("Message parsing error:", error);
        addDebugLog("WEBSOCKET_ERROR", `메시지 파싱 에러: ${error.message}`);
      }
    };

    ws.current.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnected(false);
    };

    ws.current.onclose = () => {
      console.log("WebSocket disconnected");
      setConnected(false);

      if (pingInterval.current) {
        clearInterval(pingInterval.current);
        pingInterval.current = null;
      }

      reconnectTimeout.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connectWebSocket();
      }, 5000);
    };
  }, [symbol]);

  // 웹소켓 연결 (속도 변경과 무관)
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }

      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }

      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connectWebSocket, analyzeMomentum]);
  useEffect(() => {
    const analyzeAndDisplay = () => {
      const now = Date.now();
      if (now - lastUpdate.current < updateSpeed) return;

      lastUpdate.current = now;

      // 속도 설정에 따라 화면 업데이트
      setCurrentPrice(lastPrice.current);

      // 가격 변화 계산 및 화면 업데이트
      if (priceHistory.current.length >= 2) {
        const recent = priceHistory.current.slice(-10);
        const oneSecondAgo = now - 1000;

        let closestPrice = null;
        let minTimeDiff = Infinity;

        for (const record of recent) {
          const timeDiff = Math.abs(record.time - oneSecondAgo);
          if (timeDiff < minTimeDiff && timeDiff < 2000) {
            minTimeDiff = timeDiff;
            closestPrice = record.price;
          }
        }

        if (closestPrice && lastPrice.current > 0) {
          const change = lastPrice.current - closestPrice;
          setPriceChange1s(change);
        }

        if (recent.length >= 2) {
          const previousPrice = recent[recent.length - 2].price;
          const instantChange = lastPrice.current - previousPrice;
          if (Math.abs(instantChange) > 0.01) {
            setPriceChange1s(instantChange);
          }
        }
      }

      const recentChanges = priceHistory.current.slice(-15);
      setPriceChanges(recentChanges);

      if (priceHistory.current.length >= 3) {
        analyzeMomentum();
      }
    };

    const interval = setInterval(analyzeAndDisplay, updateSpeed);
    return () => clearInterval(interval);
  }, [updateSpeed]); // updateSpeed가 변경될 때만 인터벌 재설정

  const handleSymbolChange = (newSymbol) => {
    setSymbol(newSymbol);
    setIsDropdownOpen(false);
    setSearchTerm(""); // 검색어 초기화
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

  const selectedSymbol = symbols.find((s) => s.value === symbol);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex flex-col gap-4 mb-4">
            <h1 className="text-2xl md:text-3xl font-bold">Price Momentum Analyzer</h1>

            {/* 컨트롤 버튼들 - 모바일에서는 세로 배치 */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* 속도 조절 컨트롤 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg">
                <span className="text-xs sm:text-sm text-gray-300 whitespace-nowrap">업데이트 속도:</span>
                <select
                  value={updateSpeed}
                  onChange={(e) => setUpdateSpeed(Number(e.target.value))}
                  className="bg-gray-700 text-white px-2 py-1 rounded text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                >
                  <option value={100}>초고속 (0.1초) ⚡</option>
                  <option value={250}>고속 (0.25초) 🔥</option>
                  <option value={500}>빠름 (0.5초) 🚀</option>
                  <option value={1000}>보통 (1초) 📊</option>
                  <option value={2000}>느림 (2초) 🐌</option>
                  <option value={5000}>매우 느림 (5초) 🔄</option>
                </select>
              </div>

              {/* 디버그 버튼 */}
              <button
                onClick={() => setDebugMode(!debugMode)}
                className={`px-3 py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  debugMode ? "bg-red-600 hover:bg-red-700 text-white" : "bg-gray-700 hover:bg-gray-600 text-gray-300"
                }`}
              >
                {debugMode ? "🔍 디버그 끄기" : "🔍 디버그 켜기"}
              </button>
            </div>
          </div>

          {/* 심볼 선택 드롭다운 */}
          <div className="relative mb-4">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 px-3 py-3 rounded-lg transition-colors w-full sm:min-w-[250px] relative"
              disabled={isLoadingSymbols}
            >
              {isLoadingSymbols ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm sm:text-base">코인 목록 로딩중...</span>
                </>
              ) : (
                <>
                  <span className="text-xl sm:text-2xl">{selectedSymbol?.icon}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-semibold text-sm sm:text-base truncate">{selectedSymbol?.label}</div>
                    <div className="text-xs sm:text-sm text-gray-400">{symbol}</div>
                  </div>
                  <ChevronDown className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform flex-shrink-0 ${isDropdownOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>

            {isDropdownOpen && !isLoadingSymbols && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 w-full sm:min-w-[250px] max-h-96 overflow-hidden">
                {/* 검색창 */}
                <div className="p-3 border-b border-gray-700">
                  <input
                    type="text"
                    placeholder="코인 검색... (예: BTC, 비트코인)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    전체: {symbols.length}개 | 검색결과: {filteredSymbols.length}개
                  </div>
                </div>

                {/* 코인 목록 */}
                <div className="max-h-80 overflow-y-auto">
                  {filteredSymbols.length > 0 ? (
                    filteredSymbols.map((symbolOption) => (
                      <button
                        key={symbolOption.value}
                        onClick={() => handleSymbolChange(symbolOption.value)}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors ${symbol === symbolOption.value ? "bg-gray-700 border-l-4 border-blue-500" : ""}`}
                      >
                        <span className="text-2xl">{symbolOption.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-semibold">{symbolOption.label}</div>
                          <div className="text-sm text-gray-400">{symbolOption.value}</div>
                        </div>
                        {symbol === symbolOption.value && <span className="text-green-400">✓</span>}
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-400">
                      <div className="text-lg mb-2">🔍</div>
                      <div>검색 결과가 없습니다</div>
                      <div className="text-sm mt-1">다른 검색어를 시도해보세요</div>
                    </div>
                  )}
                </div>

                {/* 하단 정보 */}
                <div className="p-2 border-t border-gray-700 bg-gray-900">
                  <button
                    onClick={() => {
                      fetchAvailableSymbols();
                      setSearchTerm("");
                    }}
                    className="w-full text-xs text-blue-400 hover:text-blue-300 py-1"
                  >
                    🔄 목록 새로고침
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <span className="text-lg sm:text-2xl font-mono">${currentPrice > 0 ? currentPrice.toFixed(2) : "---"}</span>
            <span className={`text-base sm:text-lg font-mono ${priceChange1s > 0 ? "text-green-400" : priceChange1s < 0 ? "text-red-400" : "text-gray-400"}`}>
              {priceChange1s > 0 ? "+" : ""}
              {priceChange1s.toFixed(2)}
            </span>
            <span className={`text-xs sm:text-sm ${connected ? "text-green-500" : "text-red-500"}`}>{connected ? "● Connected" : "● Disconnected"}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2 mb-2 sm:mb-0">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{getSpeedTitle()}</span>
                <span className="sm:hidden">실시간 가격 변화</span>
              </h2>
              <div className="text-xs sm:text-sm text-gray-400">현재: {updateSpeed}ms 간격</div>
            </div>
            <div className="space-y-1">
              {priceChanges
                .slice()
                .reverse()
                .map((change, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 w-20">{change.timestamp}</span>
                    {getChangeBar(change.change)}
                  </div>
                ))}
              {priceChanges.length === 0 && <div className="text-gray-500 text-center py-8">Waiting for price changes...</div>}
            </div>
          </div>

          <div className="space-y-4">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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

        {(signal.type === "STRONG_UP" || signal.type === "STRONG_DOWN") && (
          <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${signal.type === "STRONG_UP" ? "bg-green-600" : "bg-red-600"} flex items-center gap-2 animate-pulse`}>
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">{signal.type === "STRONG_UP" ? "강한 상승 압력 감지!" : "강한 하락 압력 감지!"}</span>
          </div>
        )}

        {/* 디버그 패널 */}
        {debugMode && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 웹소켓 로그 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">🔍 실시간 로그</h3>
                <button onClick={() => setDebugLogs([])} className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                  로그 지우기
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {debugLogs.map((log) => (
                  <div key={log.id} className="bg-gray-900 p-3 rounded text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-mono text-xs px-2 py-1 rounded ${
                          log.type.includes("ERROR") ? "bg-red-600" : log.type.includes("WEBSOCKET") ? "bg-blue-600" : log.type.includes("API") ? "bg-green-600" : "bg-yellow-600"
                        }`}
                      >
                        {log.type}
                      </span>
                      <span className="text-gray-400 text-xs">{log.time}</span>
                    </div>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-hidden">{typeof log.data === "object" ? JSON.stringify(log.data, null, 2) : log.data}</pre>
                  </div>
                ))}
                {debugLogs.length === 0 && <div className="text-center text-gray-500 py-8">로그가 없습니다</div>}
              </div>
            </div>

            {/* API 원본 데이터 */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">📊 API 원본 데이터</h3>
              <div className="max-h-96 overflow-y-auto">
                {rawApiData ? (
                  <div className="space-y-4">
                    <div className="bg-gray-900 p-3 rounded">
                      <h4 className="font-semibold mb-2 text-green-400">API 응답 정보</h4>
                      <div className="text-sm space-y-1">
                        <div>
                          응답 코드: <span className="text-yellow-300">{rawApiData.code}</span>
                        </div>
                        <div>
                          메시지: <span className="text-yellow-300">{rawApiData.msg}</span>
                        </div>
                        <div>
                          총 코인 수: <span className="text-yellow-300">{rawApiData.data?.length || 0}</span>
                        </div>
                      </div>
                    </div>

                    {rawApiData.data && rawApiData.data[0] && (
                      <div className="bg-gray-900 p-3 rounded">
                        <h4 className="font-semibold mb-2 text-blue-400">첫 번째 코인 샘플</h4>
                        <pre className="text-xs text-gray-300 whitespace-pre-wrap">{JSON.stringify(rawApiData.data[0], null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">API 데이터를 불러오는 중...</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BitgetPriceMomentumAnalyzer;
