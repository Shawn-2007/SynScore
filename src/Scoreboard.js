import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE, WS_BASE, postAction } from './config';
import QRCode from 'qrcode';
import { createGame, startGame, applyPoint, undo, resetGame, setSwap, toView } from './rules';
import { syncResults } from './historyStore';
import './Scoreboard.css';

// 單機模式用同一套規則在本地執行；線上模式則由後端判定，這裡只送出操作
const localReducers = {
    point: (game, { team }) => applyPoint(game, team),
    undo: (game) => undo(game),
    start: (game, { firstServe }) => startGame(game, firstServe),
    reset: (game) => resetGame(game),
    swap: (game, { swapTeams }) => setSwap(game, swapTeams),
};

// 單機比賽存在 localStorage，意外重新整理或滑掉頁面不會丟失比分
const LOCAL_GAME_KEY = 'synscore-local-game';

function loadLocalGame() {
    try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_GAME_KEY));
        if (saved && Array.isArray(saved.history)) return saved;
    } catch (error) {
        // 讀不到就當作新比賽
    }
    return createGame();
}

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 10000;

function Crown({ className }) {
    const gradientId = useId();
    return (
        <div className={`crown-label ${className}`}>
            <svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="48" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#f9d423" />
                        <stop offset="50%" stopColor="#ffecb3" />
                        <stop offset="100%" stopColor="#f9a825" />
                    </linearGradient>
                </defs>
                <path d="M4 12L16 36L32 8L48 36L60 12L56 40H8L4 12Z" fill={`url(#${gradientId})`} stroke="#ffd700" strokeWidth="2" />
            </svg>
        </div>
    );
}

function Scoreboard() {
    const location = useLocation();
    const navigate = useNavigate();
    const { mode, roomKey } = location.state || { mode: 'single', roomKey: null };
    const isOnline = mode === 'online' && !!roomKey;

    // 比賽狀態（線上：來自後端；單機：本地）
    const [rawGame, setRawGame] = useState(() => (isOnline ? createGame() : loadLocalGame()));
    const game = toView(rawGame);
    const versionRef = useRef(-1); // 忽略比目前更舊的後端更新

    const [isSwapped, setIsSwapped] = useState(false); // 鏡像（僅本機）
    const [showSettings, setShowSettings] = useState(false); // 按鈕:設定
    const [joinRoomKey, setJoinRoomKey] = useState(''); // 加入房間鑰匙
    const [errorMessage, setErrorMessage] = useState('');
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'theme-a'); // 外觀
    const [showBackOverlay, setShowBackOverlay] = useState(false); // 返回上一頁
    const [showShare, setShowShare] = useState(false); // 分享房間（連結 / QR code）
    const [qrUrl, setQrUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [pickNext, setPickNext] = useState(false); // 結算後進入「選擇先攻」
    const [startBanner, setStartBanner] = useState(null); // 新局開始時短暫顯示先攻方
    const [showServeZone, setShowServeZone] = useState(() => localStorage.getItem('serveZone') !== 'off'); // 發球區提示

    // 把外觀存到localStorage
    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        try {
            localStorage.setItem('serveZone', showServeZone ? 'on' : 'off');
        } catch (error) {
            // 忽略
        }
    }, [showServeZone]);

    // 歷史紀錄：把這個房間（或單機）已完成的場次同步到這支手機
    useEffect(() => {
        if (isOnline && !game.roomCreatedAt) return;
        syncResults(isOnline ? `room-${roomKey}-${game.roomCreatedAt}` : 'local', game.results);
    }, [isOnline, roomKey, game.roomCreatedAt, game.results]);

    // 新局開始：收起選擇畫面，並顯示先攻方（隨機時才看得出結果）
    const wasStartedRef = useRef(false);
    useEffect(() => {
        if (game.isGameStarted && !wasStartedRef.current) {
            setPickNext(false);
            if (game.teamAScore === 0 && game.teamBScore === 0 && game.firstServe) {
                setStartBanner(game.firstServe);
            }
        }
        wasStartedRef.current = game.isGameStarted;
    }, [game.isGameStarted, game.teamAScore, game.teamBScore, game.firstServe]);

    useEffect(() => {
        if (!startBanner) return;
        const timer = setTimeout(() => setStartBanner(null), 2500);
        return () => clearTimeout(timer);
    }, [startBanner]);

    // 產生分享用的 QR code
    const shareUrl = isOnline ? `${window.location.origin}${process.env.PUBLIC_URL || ''}/?room=${roomKey}` : '';
    useEffect(() => {
        if (!showShare || !shareUrl) return;
        let cancelled = false;
        QRCode.toDataURL(shareUrl, { width: 260, margin: 1 }).then(
            (url) => !cancelled && setQrUrl(url),
            () => {}
        );
        return () => {
            cancelled = true;
        };
    }, [showShare, shareUrl]);

    // 單機模式：每次變動都存檔
    useEffect(() => {
        if (isOnline) return;
        try {
            localStorage.setItem(LOCAL_GAME_KEY, JSON.stringify(rawGame));
        } catch (error) {
            // 儲存空間不可用時忽略
        }
    }, [isOnline, rawGame]);

    // 比賽進行中保持螢幕不休眠（支援的瀏覽器才有）
    useEffect(() => {
        if (!game.isGameStarted || !navigator.wakeLock) return;
        let lock = null;
        let released = false;
        const request = () =>
            navigator.wakeLock.request('screen').then(
                (l) => {
                    if (released) l.release();
                    else lock = l;
                },
                () => {}
            );
        const onVisible = () => document.visibilityState === 'visible' && request();
        request();
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            released = true;
            document.removeEventListener('visibilitychange', onVisible);
            if (lock) lock.release();
        };
    }, [game.isGameStarted]);

    // 套用後端傳來的狀態
    const applyRemote = (data) => {
        if (typeof data.version === 'number') {
            if (data.version < versionRef.current) return;
            versionRef.current = data.version;
        }
        setRawGame(data);
    };

    // WebSocket 連線
    useEffect(() => {
        if (!isOnline) return;

        setRawGame(createGame());
        versionRef.current = -1;

        let ws;
        let closed = false; // 元件卸載或換房間後不再重連
        let reconnectTimer = null;
        let reconnectAttempts = 0;

        const connectWebSocket = () => {
            ws = new WebSocket(`${WS_BASE}?room=${roomKey}`);

            ws.onopen = () => {
                reconnectAttempts = 0;
                versionRef.current = -1; // 後端重啟時 version 會重新計算
            };

            ws.onmessage = (event) => {
                applyRemote(JSON.parse(event.data));
            };

            ws.onclose = (event) => {
                if (closed) return;
                if (event.code === 4404) {
                    // 房間不存在（打錯房號，或後端重啟後房間已消失）
                    alert('房間不存在或已關閉！');
                    navigate('/', { replace: true });
                    return;
                }
                const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempts, RECONNECT_MAX_MS);
                reconnectAttempts++;
                reconnectTimer = setTimeout(connectWebSocket, delay);
            };
        };

        connectWebSocket();

        // 手機切到背景再回來時連線常已悄悄中斷，回到前景就立刻重連，不等退避計時
        const handleVisibility = () => {
            if (document.visibilityState !== 'visible' || closed) return;
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
            clearTimeout(reconnectTimer);
            reconnectAttempts = 0;
            connectWebSocket();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            closed = true;
            clearTimeout(reconnectTimer);
            document.removeEventListener('visibilitychange', handleVisibility);
            if (ws) ws.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOnline, roomKey]);

    // 執行操作：線上送給後端，單機直接在本地套用規則
    const act = async (type, payload = {}) => {
        if (!isOnline) {
            setRawGame((prev) => localReducers[type](prev, payload));
            return;
        }
        try {
            applyRemote(await postAction(type, { roomKey, ...payload }));
        } catch (error) {
            console.error(`Error sending ${type}:`, error);
        }
    };

    const gameStarted = game.isGameStarted;
    const { winner, firstServe } = game;

    const selectFirstServe = (team) => act('start', { firstServe: team });
    const incrementScore = (team) => {
        if (gameStarted) act('point', { team });
    };
    const undoLastAction = () => act('undo');

    const copyShareLink = async () => {
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            window.prompt('複製這個連結：', shareUrl);
        }
    };
    const nativeShare = () => {
        navigator.share({ title: 'SynScore 同步記分', text: `加入房間 ${roomKey}`, url: shareUrl }).catch(() => {});
    };
    // 線上重置會清掉所有人的比賽，先確認避免誤觸
    const resetScores = () => {
        if (window.confirm(isOnline ? '確定要重置比賽嗎？房間內所有人的比分都會清除。' : '確定要重置比賽嗎？')) {
            act('reset');
        }
    };
    const swapTeams = () => act('swap', { swapTeams: !game.swapTeams });

    // 按鈕:設定
    const toggleSettings = () => {
        setShowSettings(!showSettings);
        setErrorMessage('');
    };

    // 按鈕:返回上一頁
    const toggleBackOverlay = () => {
        setShowBackOverlay(!showBackOverlay);
        setErrorMessage('');
    };

    // 按鈕:返回首頁
    const handleBackToHome = () => {
        navigate('/');
        setShowBackOverlay(false);
    };

    // 按鈕:創建房間
    const handleCreateRoom = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/create-room`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to create room: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.roomKey) {
                throw new Error('No roomKey returned from server');
            }

            setShowBackOverlay(false);
            navigate('/scoreboard', { state: { mode: 'online', roomKey: data.roomKey } });
        } catch (error) {
            console.error('Error in handleCreateRoom:', error);
            setErrorMessage('無法創建房間，請稍後再試！');
        }
    };

    // 按鈕:加入房間
    const handleJoinRoom = async () => {
        if (joinRoomKey.length !== 5 || !/^\d+$/.test(joinRoomKey)) {
            setErrorMessage('請輸入有效的 5 碼數字房間金鑰！');
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/room-state?room=${joinRoomKey}`);
            if (!response.ok) {
                throw new Error(`Room does not exist or inaccessible: ${response.status}`);
            }

            setShowBackOverlay(false);
            navigate('/scoreboard', { state: { mode: 'online', roomKey: joinRoomKey } });
            setErrorMessage('');
        } catch (error) {
            console.error('Error in handleJoinRoom:', error);
            setErrorMessage('無法加入房間，請確認房間金鑰是否正確！');
        }
    };

    // 按鈕:外觀修改
    const handleThemeChange = (newTheme) => {
        setTheme(newTheme);
    };

    // 鏡像
    const mirrorTeams = () => {
        setIsSwapped(!isSwapped);
    };

    const flipped = isSwapped !== game.swapTeams;
    const leftTeam = flipped ? 'B' : 'A';
    const rightTeam = flipped ? 'A' : 'B';
    const scoreOf = (team) => (team === 'A' ? game.teamAScore : game.teamBScore);
    // 發球區：發球方分數為偶數從右區、奇數從左區發球
    const serveZoneOf = (team) => (game.servingTeam === team ? (scoreOf(team) % 2 === 0 ? '右' : '左') : null);
    const hasServeMark = (team) => (team === 'A' ? game.consecutiveA : game.consecutiveB) >= 2;

    // 彩帶位置只隨機一次，避免每次重新渲染都閃動
    const confettiPieces = useMemo(
        () =>
            [...Array(50)].map(() => ({
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
            })),
        []
    );

    // 頁面:主要計分頁面
    let mainPage;
    if (gameStarted) {
        mainPage = (
            <>
                <div className="scoreboard">
                    {/* 當點擊時加分 */}
                    <div
                        className={`team team-left ${leftTeam === 'A' ? 'team-a' : 'team-b'}`}
                        onClick={() => incrementScore(leftTeam)}
                    >
                        {showServeZone && serveZoneOf(leftTeam) && <span className="serve-zone">發球 {serveZoneOf(leftTeam)}區</span>}
                        <h2>隊伍 {leftTeam}</h2>
                        <p className={`score-text score-medium`}>
                            {scoreOf(leftTeam)}
                        </p>
                        <div className="consecutive-serve-container">
                            <div
                                className={`consecutive-serve ${leftTeam === 'A' ? 'team-a-serve' : 'team-b-serve'}`}
                                style={{ display: hasServeMark(leftTeam) ? 'block' : 'none' }}
                            >
                                {/* 連發 */}
                            </div>
                        </div>
                    </div>

                    <div
                        className={`team team-right ${rightTeam === 'A' ? 'team-a' : 'team-b'}`}
                        onClick={() => incrementScore(rightTeam)}
                    >
                        {showServeZone && serveZoneOf(rightTeam) && <span className="serve-zone">發球 {serveZoneOf(rightTeam)}區</span>}
                        <h2>隊伍 {rightTeam}</h2>
                        <p className={`score-text score-medium`}>
                            {scoreOf(rightTeam)}
                        </p>
                        <div className="consecutive-serve-container">
                            <div
                                className={`consecutive-serve `}
                                style={{ display: hasServeMark(rightTeam) ? 'block' : 'none' }}
                            >
                                {/* 連發 */}
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )
    }

    // 頁面:下方按鈕
    const bottomButton = (
        <>
            <div className="bottomButtons">
                <button className="mirror-button" onClick={mirrorTeams}>鏡射</button>
                <button className="swap-button" onClick={swapTeams}>互換</button>
                <button className={showServeZone ? '' : 'toggle-off'} onClick={() => setShowServeZone(!showServeZone)}>發球區{showServeZone ? '：開' : '：關'}</button>
                <button onClick={resetScores}>重置</button>
            </div>
        </>
    );

    // 頁面:上方按鈕
    const topButton = (
        <>
            <button className="back-button" onClick={toggleBackOverlay}>
                返回
            </button>
            <div className="top-right-buttons">
                {isOnline && (
                    <button className="share-button" onClick={() => setShowShare(true)}>
                        分享
                    </button>
                )}
                <button className="undo-button" onClick={undoLastAction} disabled={!game.canUndo}>
                    回復
                </button>
                {/* <button className="settings-button" onClick={toggleSettings}>
                    設定
                </button> */}
            </div>

            <h1 className="scoreboard-title">
                {isOnline ? `(房間: ${roomKey})` : ''}
            </h1>
        </>
    );

    // 頁面:上一頁
    let previousPage;
    if (showBackOverlay) {
        previousPage = (
            <>
                <div className="back-overlay">
                    <div className="back-panel">
                        <button className="back-home-button" onClick={handleBackToHome}>
                            返回首頁
                        </button>
                        <button className="close-back-overlay" onClick={toggleBackOverlay}>
                            返回記分板
                        </button>

                        <h1>羽球計分系統</h1>
                        <div className="online-options">
                            <button onClick={handleCreateRoom}>創建房間</button>
                            <div className="join-room">
                                <input
                                    type="text"
                                    placeholder="輸入 5 碼房間金鑰"
                                    value={joinRoomKey}
                                    onChange={(e) => {
                                        setJoinRoomKey(e.target.value);
                                        setErrorMessage('');
                                    }}
                                    maxLength={5}
                                />
                                <button onClick={handleJoinRoom}>加入房間</button>
                            </div>
                            {errorMessage && <p className="error-message">{errorMessage}</p>}
                        </div>
                    </div>
                </div>
            </>
        )
    }

    // 頁面:設定頁面
    let settingsPage;
    if (showSettings) {
        settingsPage = (
            <>
                <div className="settings-overlay">
                    <div className="settings-panel">
                        <h2>設定</h2>
                        <div className="settings-options">
                            <div className="theme-options">
                                <h3>切換外觀</h3>
                                <button
                                    className={theme === 'theme-a' ? 'active' : ''}
                                    onClick={() => handleThemeChange('theme-a')}
                                >
                                    外觀 A
                                </button>
                                <button
                                    className={theme === 'theme-b' ? 'active' : ''}
                                    onClick={() => handleThemeChange('theme-b')}
                                >
                                    外觀 B
                                </button>
                            </div>
                        </div>
                        <button className="close-settings" onClick={toggleSettings}>
                            關閉
                        </button>
                    </div>
                </div>
            </>
        )
    }

    // 特效頁面:灑彩帶
    const sprinkles = (
        <>
            <div className={`confetti-container ${gameStarted ? '' : 'active'}`}>
                {confettiPieces.map((style, i) => (
                    <div key={i} className="confetti-piece" style={style} />
                ))}
            </div>
        </>
    );

    // 選擇先攻隊伍的按鈕（依左右位置排列）
    const serveButton = (team) => (
        <button
            key={team}
            className={`serve-button ${team === 'A' ? 'team-a' : 'team-b'}`}
            onClick={() => selectFirstServe(team)}
        >
            {team === 'A' ? '紅方先攻' : '藍方先攻'}
        </button>
    );

    // 選擇先攻：指定一方，或隨機決定
    const serveChooser = (
        <>
            <div className="serve-choose-text">
                <h2>選擇先攻隊伍</h2>
            </div>
            <div className="serve-buttons">
                {serveButton(leftTeam)}
                {serveButton(rightTeam)}
            </div>
            <div className="serve-buttons">
                <button className="serve-button random" onClick={() => selectFirstServe('random')}>
                    🎲 隨機決定
                </button>
            </div>
        </>
    );

    // 首次選擇先攻隊伍，或結算後按「再來一局」
    let firstSelectPage;
    if (!gameStarted && ((!winner && firstServe === null) || pickNext)) {
        firstSelectPage = (
            <>
                <div className="select-serve">
                    {serveChooser}
                    {pickNext && winner && (
                        <button className="plain-button" onClick={() => setPickNext(false)}>
                            ← 返回結算
                        </button>
                    )}
                </div>
            </>
        )
    }

    // 頁面:結算畫面（比分直接使用後端判定的最終比分）
    let showWinPage;
    if (!gameStarted && winner && !pickNext) {
        const textClass = (team) => (team === 'A' ? 'team-a-text' : 'team-b-text');
        const crownClass = (team) => (team === 'A' ? 'team-a-crown' : 'team-b-crown');
        showWinPage = (
            <>
                <div className="select-serve">
                    <div className="victory-message">
                        <div className="final-score-container">
                            <div className="final-score team-a-score">
                                <span className={textClass(leftTeam)}>{scoreOf(leftTeam)}</span>
                                {winner === leftTeam && <Crown className={crownClass(leftTeam)} />}
                            </div>
                            <span> : </span>
                            <div className="final-score team-b-score">
                                <span className={textClass(rightTeam)}>{scoreOf(rightTeam)}</span>
                                {winner === rightTeam && <Crown className={crownClass(rightTeam)} />}
                            </div>
                        </div>
                    </div>

                    <div className="serve-buttons">
                        <button className="serve-button next-game" onClick={() => setPickNext(true)}>
                            再來一局
                        </button>
                    </div>
                    {game.canUndo && (
                        <button className="plain-button" onClick={undoLastAction}>
                            ↩ 誤按？回復最後一分
                        </button>
                    )}
                </div>
            </>
        )
    }

    // 頁面:分享房間
    let sharePage;
    if (showShare && isOnline) {
        sharePage = (
            <div className="back-overlay">
                <div className="share-panel">
                    <h1>邀請朋友加入</h1>
                    <p className="share-room">房間 {roomKey}</p>
                    {qrUrl ? <img className="share-qr" src={qrUrl} alt="房間 QR code" /> : <div className="share-qr" />}
                    <p className="share-hint">用手機相機掃描，或傳送連結</p>
                    <div className="share-actions">
                        <button onClick={copyShareLink}>{copied ? '已複製 ✓' : '複製連結'}</button>
                        {navigator.share && <button onClick={nativeShare}>分享…</button>}
                        <button className="plain-button" onClick={() => setShowShare(false)}>關閉</button>
                    </div>
                </div>
            </div>
        );
    }

    // 新局開始提示
    const startBannerBox = startBanner && (
        <div className="start-banner">先攻：{startBanner === 'A' ? '紅方' : '藍方'}</div>
    );

    // 渲染
    return (
        <div className={`app ${theme}`}>

            {/* 上一頁頁面 */}
            {previousPage}

            {sharePage}
            {startBannerBox}

            {/* 設定頁面 */}
            {settingsPage}

            {/* 特效頁面:灑彩帶 */}
            {sprinkles}

            {/* 結算畫面 */}
            {showWinPage}

            {/* 首次選擇先攻畫面 */}
            {firstSelectPage}

            {/* 上方按鈕 */}
            {topButton}

            {/* 主要計分頁面 */}
            {mainPage}

            {/* 下方按鈕 */}
            {gameStarted && bottomButton}

        </div>
    );
}

export default Scoreboard;
