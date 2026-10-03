import React, { useState, useEffect, useRef, useMemo, useId } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { WS_BASE, postAction } from './config';
import QRCode from 'qrcode';
import { createGame, newGame, startGame, setFirstServe, applyPoint, undo, resetGame, setSwap, toView } from './rules';
import { syncResults } from './historyStore';
import { ResultItem } from './ResultList';
import './Scoreboard.css';

// 單機模式用同一套規則在本地執行；線上模式則由後端判定，這裡只送出操作
const localReducers = {
    point: (game, { team }) => applyPoint(game, team),
    undo: (game) => undo(game),
    start: (game, { firstServe }) => startGame(game, firstServe),
    serve: (game, { firstServe }) => setFirstServe(game, firstServe),
    reset: (game) => resetGame(game),
    swap: (game, { swapTeams }) => setSwap(game, swapTeams),
};

// 單機比賽存在 localStorage，意外重新整理或滑掉頁面不會丟失比分
const LOCAL_GAME_KEY = 'synscore-local-game';

function loadLocalGame() {
    try {
        const saved = JSON.parse(localStorage.getItem(LOCAL_GAME_KEY));
        if (saved && Array.isArray(saved.history)) return { ...createGame(), ...saved };
    } catch (error) {
        // 讀不到就當作新比賽
    }
    return newGame(createGame(), 'A');
}

const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 10000;
const LEAVE_DELAY_SECONDS = 3; // 按「離開」前的等待秒數，避免手快誤按

const teamLabel = (team) => (team === 'A' ? '紅方' : '藍方');

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
    const rawRef = useRef(rawGame); // 單機連續操作時取得最新狀態
    rawRef.current = rawGame;
    const game = toView(rawGame);
    const versionRef = useRef(-1); // 忽略比目前更舊的後端更新
    const [loaded, setLoaded] = useState(!isOnline); // 線上：收到第一份房間狀態前顯示「連線中」

    const [isSwapped, setIsSwapped] = useState(false); // 鏡像（僅本機）
    const [theme] = useState(localStorage.getItem('theme') || 'theme-a'); // 外觀
    const [showLeave, setShowLeave] = useState(false); // 離開確認
    const [leaveCountdown, setLeaveCountdown] = useState(0);
    const [showRecords, setShowRecords] = useState(false); // 本房間紀錄
    const [showShare, setShowShare] = useState(false); // 分享房間（連結 / QR code）
    const [qrUrl, setQrUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [startBanner, setStartBanner] = useState(null); // 先攻方變動時短暫顯示
    const [showServeZone, setShowServeZone] = useState(() => localStorage.getItem('serveZone') !== 'off'); // 發球區提示

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

    // 其他人開新局、更改先攻方時，也讓這一端看到先攻方
    const prevRef = useRef({ loaded: false, started: false, firstServe: null });
    useEffect(() => {
        if (!loaded) return;
        const prev = prevRef.current;
        const atZero = game.teamAScore === 0 && game.teamBScore === 0;
        if (prev.loaded && game.isGameStarted && atZero && game.firstServe
            && (!prev.started || prev.firstServe !== game.firstServe)) {
            setStartBanner(game.firstServe);
        }
        prevRef.current = { loaded: true, started: game.isGameStarted, firstServe: game.firstServe };
    }, [loaded, game.isGameStarted, game.teamAScore, game.teamBScore, game.firstServe]);

    useEffect(() => {
        if (!startBanner) return;
        const timer = setTimeout(() => setStartBanner(null), 2500);
        return () => clearTimeout(timer);
    }, [startBanner]);

    // 離開確認：倒數幾秒後才能按「離開」
    useEffect(() => {
        if (!showLeave) return;
        setLeaveCountdown(LEAVE_DELAY_SECONDS);
        const timer = setInterval(() => {
            setLeaveCountdown((n) => (n > 0 ? n - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [showLeave]);

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
        setLoaded(true);
    };

    // WebSocket 連線
    useEffect(() => {
        if (!isOnline) return;

        setRawGame(createGame());
        setLoaded(false);
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

    // 執行操作：線上送給後端，單機直接在本地套用規則。回傳最新狀態（失敗時為 null）
    const act = async (type, payload = {}) => {
        if (!isOnline) {
            const next = localReducers[type](rawRef.current, payload);
            rawRef.current = next;
            setRawGame(next);
            return toView(next);
        }
        try {
            const data = await postAction(type, { roomKey, ...payload });
            applyRemote(data);
            return data;
        } catch (error) {
            console.error(`Error sending ${type}:`, error);
            return null;
        }
    };

    const gameStarted = game.isGameStarted;
    const { winner, firstServe } = game;

    // 開局前 0:0 的先攻選擇（含隨機）；隨機的結果用提示顯示，避免結果和原本相同時看不出來
    const chooseFirstServe = async (team, type = 'serve') => {
        const next = await act(type, { firstServe: team });
        if (next && team === 'random') setStartBanner(next.firstServe);
    };
    const incrementScore = (team) => {
        if (gameStarted) act('point', { team });
    };
    const undoLastAction = () => act('undo');
    // 上一局的勝方先發球
    const nextGame = () => chooseFirstServe(winner, 'start');

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

    // 離開
    const handleLeave = () => {
        setShowLeave(false);
        navigate('/');
    };

    // 鏡像
    const mirrorTeams = () => {
        setIsSwapped(!isSwapped);
    };

    const flipped = isSwapped !== game.swapTeams;
    const leftTeam = flipped ? 'B' : 'A';
    const rightTeam = flipped ? 'A' : 'B';
    const scoreOf = (team) => (team === 'A' ? game.teamAScore : game.teamBScore);

    // 發球區：發球方分數為偶數從右區、奇數從左區發球。
    // 以球場俯視、球網在中間來看：左邊的隊伍面向右，右發球區在下半；右邊的隊伍面向左，右發球區在上半。
    const serveHalfOf = (team, side) => {
        if (game.servingTeam !== team) return null;
        const isRightCourt = scoreOf(team) % 2 === 0;
        if (side === 'left') return isRightCourt ? 'bottom' : 'top';
        return isRightCourt ? 'top' : 'bottom';
    };

    // 每隊區塊的底層：兩個發球區（發球的那半高亮）與羽球圖示
    const serveOverlay = (team, side) => {
        const serving = game.servingTeam === team;
        const half = showServeZone ? serveHalfOf(team, side) : null;
        return (
            <>
                {showServeZone && (
                    <div className="serve-halves">
                        <div className={`serve-half ${half === 'top' ? 'active' : ''}`} />
                        <div className={`serve-half ${half === 'bottom' ? 'active' : ''}`} />
                    </div>
                )}
                {serving && (
                    <div className={`serve-icon ${half ? `in-${half} on-${side}` : 'plain'}`} />
                )}
            </>
        );
    };

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
                        {serveOverlay(leftTeam, 'left')}
                        <h2>隊伍 {leftTeam}</h2>
                        <p className={`score-text score-medium`}>
                            {scoreOf(leftTeam)}
                        </p>
                    </div>

                    <div
                        className={`team team-right ${rightTeam === 'A' ? 'team-a' : 'team-b'}`}
                        onClick={() => incrementScore(rightTeam)}
                    >
                        {serveOverlay(rightTeam, 'right')}
                        <h2>隊伍 {rightTeam}</h2>
                        <p className={`score-text score-medium`}>
                            {scoreOf(rightTeam)}
                        </p>
                    </div>
                </div>
            </>
        )
    }

    // 0:0 且還沒得分時，可以直接在這裡改先攻方或骰先攻
    const canPickServe = gameStarted && game.teamAScore === 0 && game.teamBScore === 0 && !game.canUndo;
    const servePicker = canPickServe && (
        <div className="serve-picker">
            <span className="serve-picker-label">先攻</span>
            {[leftTeam, rightTeam].map((team) => (
                <button
                    key={team}
                    className={`pick-${team === 'A' ? 'a' : 'b'} ${firstServe === team ? 'on' : ''}`}
                    onClick={() => chooseFirstServe(team)}
                >
                    {teamLabel(team)}
                </button>
            ))}
            <button className="pick-random" onClick={() => chooseFirstServe('random')}>🎲 隨機</button>
        </div>
    );

    // 頁面:下方按鈕
    const bottomButton = (
        <>
            {servePicker}
            <div className="bottomButtons">
                <button className="mirror-button" onClick={mirrorTeams}>鏡射</button>
                <button className="swap-button" onClick={swapTeams}>互換</button>
                <button className={showServeZone ? '' : 'toggle-off'} onClick={() => setShowServeZone(!showServeZone)}>發球區{showServeZone ? '' : ' ✕'}</button>
                <button onClick={() => setShowRecords(true)}>紀錄</button>
                <button onClick={resetScores}>重置</button>
            </div>
        </>
    );

    // 頁面:上方按鈕
    const topButton = (
        <>
            <button className="back-button" onClick={() => setShowLeave(true)}>
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
            </div>

            <h1 className="scoreboard-title">
                {isOnline ? `(房間: ${roomKey})` : ''}
            </h1>
        </>
    );

    // 離開確認（取代原本的「返回」頁面）
    let leavePage;
    if (showLeave) {
        leavePage = (
            <div className="leave-overlay" onClick={() => setShowLeave(false)}>
                <div className="leave-box" onClick={(e) => e.stopPropagation()}>
                    <h2>離開比賽？</h2>
                    <p>
                        {isOnline
                            ? `比賽不會結束。房間 ${roomKey} 會保留約 2 小時，之後可以用房號或分享連結再回來。`
                            : '目前的比分已自動儲存，下次進入「單機計分」會接著打。'}
                    </p>
                    <button className="leave-cancel" onClick={() => setShowLeave(false)}>
                        繼續比賽
                    </button>
                    <button className="leave-confirm" onClick={handleLeave} disabled={leaveCountdown > 0}>
                        {leaveCountdown > 0 ? `離開（${leaveCountdown}）` : '離開'}
                    </button>
                </div>
            </div>
        );
    }

    // 本房間（或單機）的紀錄
    let recordsPage;
    if (showRecords) {
        const wins = { A: 0, B: 0 };
        game.results.forEach((r) => {
            wins[r.winner] += 1;
        });
        recordsPage = (
            <div className="back-overlay">
                <div className="records-panel">
                    <h1>{isOnline ? `房間 ${roomKey} 的紀錄` : '單機紀錄'}</h1>
                    <p className="records-tally">
                        <span className="team-a-text">紅方 {wins.A} 勝</span>
                        <span> ・ </span>
                        <span className="team-b-text">藍方 {wins.B} 勝</span>
                    </p>
                    <div className="records-list">
                        {game.results.length === 0 && <p className="history-empty">還沒有打完的比賽。</p>}
                        {[...game.results].reverse().map((r) => (
                            <ResultItem key={r.endedAt} result={r} />
                        ))}
                    </div>
                    <div className="share-actions">
                        <button className="plain-button" onClick={() => navigate('/history')}>所有歷史紀錄</button>
                        <button onClick={() => setShowRecords(false)}>關閉</button>
                    </div>
                </div>
            </div>
        );
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

    // 尚未開局（舊資料或未知狀態）時的先攻選擇；正常流程是直接開局
    let firstSelectPage;
    if (loaded && !gameStarted && !winner) {
        firstSelectPage = (
            <>
                <div className="select-serve">
                    <div className="serve-choose-text">
                        <h2>選擇先攻隊伍</h2>
                    </div>
                    <div className="serve-buttons">
                        {[leftTeam, rightTeam].map((team) => (
                            <button
                                key={team}
                                className={`serve-button ${team === 'A' ? 'team-a' : 'team-b'}`}
                                onClick={() => chooseFirstServe(team, 'start')}
                            >
                                {teamLabel(team)}先攻
                            </button>
                        ))}
                    </div>
                    <div className="serve-buttons">
                        <button className="serve-button random" onClick={() => chooseFirstServe('random', 'start')}>
                            🎲 隨機決定
                        </button>
                    </div>
                </div>
            </>
        )
    }

    // 頁面:結算畫面（比分直接使用後端判定的最終比分）
    let showWinPage;
    if (loaded && !gameStarted && winner) {
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
                        <button className="serve-button next-game" onClick={nextGame}>
                            再來一局
                        </button>
                    </div>
                    <p className="next-game-hint">{teamLabel(winner)}（上一局的勝方）先攻，開局後可以更改</p>
                    {game.canUndo && (
                        <button className="plain-button" onClick={undoLastAction}>
                            ↩ 誤按？回復最後一分
                        </button>
                    )}
                    <button className="plain-button" onClick={() => setShowRecords(true)}>
                        查看紀錄
                    </button>
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

    // 先攻方提示
    const startBannerBox = startBanner && (
        <div className="start-banner">先攻：{teamLabel(startBanner)}</div>
    );

    // 渲染
    return (
        <div className={`app ${theme}`}>

            {leavePage}
            {recordsPage}
            {sharePage}
            {startBannerBox}

            {/* 特效頁面:灑彩帶 */}
            {sprinkles}

            {/* 結算畫面 */}
            {showWinPage}

            {/* 尚未開局時的先攻選擇（備援） */}
            {firstSelectPage}

            {/* 線上：等第一份房間狀態 */}
            {!loaded && <div className="loading-overlay">連線中…</div>}

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
