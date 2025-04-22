import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './Scoreboard.css';

// 後端地址
// const BACKEND_URL = 'nas.shawn4x4.com:3001';
// const BACKEND_URL = 'ec.shawn4x4.com:3001';
const BACKEND_URL = 'api.shawn4x4.com';

function Scoreboard() {
    const [teamAScore, setTeamAScore] = useState(0); // A組分數
    const [teamBScore, setTeamBScore] = useState(0);
    const [isSwapped, setIsSwapped] = useState(false); // 鏡像
    const location = useLocation();
    const navigate = useNavigate();
    const { mode, roomKey } = location.state || { mode: 'single', roomKey: null };

    const [gameStarted, setGameStarted] = useState(false); // 遊戲開始
    const [servingTeam, setServingTeam] = useState(null); // 當前隊伍
    const [firstServe, setFirstServe] = useState(null); // 先發球
    const [countdown, setCountdown] = useState(null);
    const [consecutiveScoresA, setConsecutiveScoresA] = useState(0); // A組連續得分
    const [consecutiveScoresB, setConsecutiveScoresB] = useState(0); // B組連續得分
    const [showSettings, setShowSettings] = useState(false); // 按鈕:設定
    // const [fontSize, setFontSize] = useState('medium');
    const [joinRoomKey, setJoinRoomKey] = useState(''); // 加入房間鑰匙
    const [winner, setWinner] = useState(null); // 獲勝者
    const [finalScoreA, setFinalScoreA] = useState(0); // A組最終分數
    const [finalScoreB, setFinalScoreB] = useState(0); // B組最終分數
    const [errorMessage, setErrorMessage] = useState('');
    const [history, setHistory] = useState([]); // 歷史
    const [isTeamsSwapped, setIsTeamsSwapped] = useState(false); // 互換
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'theme-a'); // 外觀
    const [showBackOverlay, setShowBackOverlay] = useState(false); // 返回上一頁
    const [isGameEndInitiator, setIsGameEndInitiator] = useState(false); // 是遊戲結束發起者 


    // 把外觀存到localStorage
    useEffect(() => {
        localStorage.setItem('theme', theme);
    }, [theme]);


    const prevTeamAScoreRef = useRef(teamAScore);
    const prevTeamBScoreRef = useRef(teamBScore);

    // 連線連發計算與保存
    useEffect(() => {
        if (!gameStarted) return;
        if (gameStarted && teamAScore === 0) {
            setConsecutiveScoresA(0);
        }
        if (gameStarted && teamBScore === 0) {
            setConsecutiveScoresB(0);
        }

        // saveStateToHistory();

        const prevA = prevTeamAScoreRef.current;
        const prevB = prevTeamBScoreRef.current;

        // 判斷是哪一隊得分
        if (teamAScore > prevA && teamBScore === prevB) {
            // A 隊得分
            setConsecutiveScoresA((prev) => {
                const next = prev + 1;
                return next >= 2 ? 2 : next;
            });
            setConsecutiveScoresB(0);

        } else if (teamBScore > prevB && teamAScore === prevA) {
            // B 隊得分
            setConsecutiveScoresB((prev) => {
                const next = prev + 1;
                return next >= 2 ? 2 : next;
            });
            setConsecutiveScoresA(0);

        } else if (teamAScore > prevA && teamBScore > prevB) {
            // 同時變動，可能是初始化或重置，不計
            setConsecutiveScoresA(0);
            setConsecutiveScoresB(0);
        }
        // 更新參考用的前一個分數
        prevTeamAScoreRef.current = teamAScore;
        prevTeamBScoreRef.current = teamBScore;

    }, [teamAScore, teamBScore]);

    // WebSocket 連線
    useEffect(() => {
        if (mode !== 'online' || !roomKey) return;

        let ws;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        const reconnectInterval = 2000;
        let lastTeamAScore = teamAScore;
        let lastTeamBScore = teamBScore;


        // 連接WebSocket
        const connectWebSocket = () => {
            // ws = new WebSocket(`ws://${BACKEND_URL}?room=${roomKey}`);
            // ws = new WebSocket(`ws://ec.shawn4x4.com:3001?room=${roomKey}`);
            ws = new WebSocket(`wss://api.shawn4x4.com/ws/?room=${roomKey}`);

            ws.onopen = () => {
                // console.log(`Connected to WebSocket server (Room: ${roomKey})`);
                reconnectAttempts = 0;
                fetchRoomState();
            };

            ws.onmessage = (event) => {
                // console.log('Received WebSocket message:', event.data);
                const data = JSON.parse(event.data);
                const newTeamAScore = data.teamAScore || 0;
                const newTeamBScore = data.teamBScore || 0;

                setTeamAScore(newTeamAScore);
                setTeamBScore(newTeamBScore);
                setServingTeam(data.servingTeam || null);
                setGameStarted(data.isGameStarted || false);
                setFirstServe(data.firstServe || null);
                if (data.swapTeams !== undefined) {
                    setIsTeamsSwapped(data.swapTeams);
                }

                // 非操作端推斷比賽結束
                if (!isGameEndInitiator && data.isGameStarted === false && newTeamAScore === 0 && newTeamBScore === 0) {
                    if (lastTeamAScore > lastTeamBScore) {
                        setWinner('A');
                        setFinalScoreA(lastTeamAScore);
                        setFinalScoreB(lastTeamBScore);
                    } else if (lastTeamBScore > lastTeamAScore) {
                        setWinner('B');
                        setFinalScoreA(lastTeamAScore);
                        setFinalScoreB(lastTeamBScore);
                    }
                }

                // 更新最後一次比分（僅當比分非零時）
                if (newTeamAScore !== 0 || newTeamBScore !== 0) {
                    lastTeamAScore = newTeamAScore;
                    lastTeamBScore = newTeamBScore;
                }
            };

            ws.onclose = () => {
                // console.log('Disconnected from WebSocket server');
                if (reconnectAttempts < maxReconnectAttempts) {
                    // console.log(`Reconnecting in ${reconnectInterval / 1000} seconds... (Attempt ${reconnectAttempts + 1})`);
                    setTimeout(connectWebSocket, reconnectInterval);
                    reconnectAttempts++;
                } else {
                    console.log('Max reconnect attempts reached. Please refresh the page.');
                }
            };

            ws.onerror = (error) => {
                // console.log('WebSocket error:', error);
            };
        };

        // 取得房間狀態
        const fetchRoomState = async () => {
            try {
                const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/room-state?room=${roomKey}`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                setTeamAScore(data.teamAScore || 0);
                setTeamBScore(data.teamBScore || 0);
                setServingTeam(data.servingTeam || null);
                setGameStarted(data.isGameStarted || false);
                setFirstServe(data.firstServe || null);
                setIsTeamsSwapped(data.swapTeams || false);

            } catch (error) {
                console.error('Error fetching room state:', error);
            }
        };

        connectWebSocket();

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [mode, roomKey]);

    // 倒數三秒
    useEffect(() => {
        if (countdown === null || countdown <= 0) return;

        const timer = setTimeout(() => {
            setCountdown(countdown - 1);
            if (countdown - 1 === 0) {
                setGameStarted(true);
                updateGameStarted(true);
                saveStateToHistory();
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);


    // 選擇先發球
    const selectFirstServe = async (team) => {
        setFirstServe(team);
        setServingTeam(team);
        setCountdown(1); //倒數
        setWinner(null);
        setFinalScoreA(0);
        setFinalScoreB(0);
        setIsGameEndInitiator(false);
        setHistory([]);
        if (team === "A") {
            setConsecutiveScoresA(2);
            setConsecutiveScoresB(1);
        } else {
            setConsecutiveScoresA(1);
            setConsecutiveScoresB(2);
        }

        if (mode === 'online' && roomKey) {
            try {
                await fetch(`https://${BACKEND_URL}/nodeApi/api/update-first-serve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        firstServe: team,
                        servingTeam: team,
                        isGameStarted: false,
                    }),
                });
            } catch (error) {
                console.error('Error updating first serve:', error);
            }
        }
    };

    // 更新遊戲開始
    const updateGameStarted = async (isStarted) => {
        if (mode === 'online' && roomKey) {
            try {
                await fetch(`https://${BACKEND_URL}/nodeApi/api/update-game-started`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        isGameStarted: isStarted,
                    }),
                });
            } catch (error) {
                console.error('Error updating game started:', error);
            }
        }
    };

    // 保存狀態到歷史
    const saveStateToHistory = () => {
        setHistory((prevHistory) => [
            ...prevHistory,
            {
                teamAScore,
                teamBScore,
                servingTeam,
                consecutiveScoresA,
                consecutiveScoresB,
            },
        ]);
    };


    // 撤銷上一個操作，回復
    const undoLastAction = async () => {

        if (history.length === 0) return;

        const lastState = history[history.length - 1];
        // setTeamAScore(lastState.teamAScore);
        // setTeamBScore(lastState.teamBScore);
        // setServingTeam(lastState.servingTeam);

        if (mode === 'online' && roomKey) {
            try {
                const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/update-score`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        teamAScore: lastState.teamAScore,
                        teamBScore: lastState.teamBScore,
                        servingTeam: lastState.servingTeam,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error sending update to backend:', error);
            }
        } else {
            setTeamAScore(lastState.teamAScore);
            setTeamBScore(lastState.teamBScore);
            setServingTeam(lastState.servingTeam);
        }

        console.log("按下按鈕")
        console.log(history)

        setConsecutiveScoresA(lastState.consecutiveScoresA);
        setConsecutiveScoresB(lastState.consecutiveScoresB);

        setHistory((prevHistory) => prevHistory.slice(0, -1));

    };

    // 增加分數
    const incrementScore = async (team) => {
        if (!gameStarted) return;

        saveStateToHistory();

        // 誇張化加分以供測試
        let newTeamAScore = team === 'A' ? teamAScore + 1 : teamAScore;
        let newTeamBScore = team === 'B' ? teamBScore + 1 : teamBScore;


        let newServingTeam = servingTeam;

        if (team === 'A') {
            newServingTeam = 'A';
        } else {
            newServingTeam = 'B';
        }
        setServingTeam(newServingTeam);

        let gameEnded = false;
        if (newTeamAScore >= 21 || newTeamBScore >= 21) {
            if (newTeamAScore >= 30 || newTeamBScore >= 30) {
                if (newTeamAScore >= 30) {
                    setWinner('A');
                    setFinalScoreA(newTeamAScore - 1);
                    setFinalScoreB(newTeamBScore);
                    gameEnded = true;
                } else if (newTeamBScore >= 30) {
                    setWinner('B');
                    setFinalScoreA(newTeamAScore);
                    setFinalScoreB(newTeamBScore - 1);
                    gameEnded = true;
                }
            } else if (newTeamAScore >= 21 && newTeamBScore < 20) {
                setWinner('A');
                setFinalScoreA(newTeamAScore);
                setFinalScoreB(newTeamBScore);
                gameEnded = true;
            } else if (newTeamBScore >= 21 && newTeamAScore < 20) {
                setWinner('B');
                setFinalScoreA(newTeamAScore);
                setFinalScoreB(newTeamBScore);
                gameEnded = true;
            } else if (newTeamAScore >= 20 && newTeamBScore >= 20) {
                if (newTeamAScore - newTeamBScore >= 2) {
                    setWinner('A');
                    setFinalScoreA(newTeamAScore);
                    setFinalScoreB(newTeamBScore);
                    gameEnded = true;
                } else if (newTeamBScore - newTeamAScore >= 2) {
                    setWinner('B');
                    setFinalScoreA(newTeamAScore);
                    setFinalScoreB(newTeamBScore);
                    gameEnded = true;
                }
            }
        }

        // 遊戲結束 重設
        if (gameEnded) {
            setIsGameEndInitiator(true);
            setGameStarted(false);
            setFirstServe(null);
            setServingTeam(null);
            setCountdown(null); //倒數
            setHistory([]);
            newTeamAScore = 0;
            newTeamBScore = 0;
            setTeamAScore(0);
            setTeamBScore(0);
            setConsecutiveScoresA(0);
            setConsecutiveScoresB(0);
            updateGameStarted(false);

        }

        if (mode === 'online' && roomKey) {
            try {
                const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/update-score`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        teamAScore: newTeamAScore,
                        teamBScore: newTeamBScore,
                        servingTeam: newServingTeam,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error sending update to backend:', error);
            }
        } else {
            setTeamAScore(newTeamAScore);
            setTeamBScore(newTeamBScore);
        }
    };

    // 重置分數
    const resetScores = async () => {
        if (mode === 'online' && roomKey) {
            try {
                const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/update-score`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        teamAScore: 0,
                        teamBScore: 0,
                        servingTeam: null,
                        isGameStarted: false,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                setGameStarted(false);
                setFirstServe(null);
                setCountdown(null); //倒數
            } catch (error) {
                console.error('Error resetting scores:', error);
            }
        } else {
            setTeamAScore(0);
            setTeamBScore(0);
            setConsecutiveScoresA(0);
            setConsecutiveScoresB(0);
            setGameStarted(false);
            setFirstServe(null);
            setServingTeam(null);
            setCountdown(null); //倒數
            setWinner(null);
            setHistory([]);
        }
    };

    // 互換
    const swapTeams = async () => {
        const newSwapState = !isTeamsSwapped;
        setIsTeamsSwapped(newSwapState);

        if (mode === 'online' && roomKey) {
            try {
                const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/update-swap`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        swapTeams: newSwapState,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error swapping teams:', error);
            }
        }
    };



    // 按鈕:設定
    const toggleSettings = () => {
        setShowSettings(!showSettings);
        setErrorMessage('');
    };

    // 按鈕:返回上一頁
    const toggleBackOverlay = () => {
        setShowBackOverlay(!showBackOverlay);
    };

    // 按鈕:返回首頁
    const handleBackToHome = () => {
        navigate('/');
        setShowBackOverlay(false);
    };

    // 按鈕:創建房間
    const handleCreateRoom = async () => {
        try {
            console.log('Attempting to create room...');
            const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/create-room`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to create room: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Create room response:', data);

            if (!data.roomKey) {
                throw new Error('No roomKey returned from server');
            }

            const newRoomKey = data.roomKey;
            setShowBackOverlay(false);
            navigate('/scoreboard', { state: { mode: 'online', roomKey: newRoomKey } });
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
            console.log('Attempting to join room:', joinRoomKey);
            const response = await fetch(`https://${BACKEND_URL}/nodeApi/api/room-state?room=${joinRoomKey}`);
            if (!response.ok) {
                throw new Error(`Room does not exist or inaccessible: ${response.status}`);
            }

            const data = await response.json();
            // console.log('Join room response:', data);

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

    const leftTeam = (isSwapped !== isTeamsSwapped) ? 'B' : 'A';
    const rightTeam = (isSwapped !== isTeamsSwapped) ? 'A' : 'B';


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
                        <h2>隊伍 {leftTeam}</h2>
                        <p className={`score-text score-medium`}>
                            {leftTeam === 'A' ? teamAScore : teamBScore}
                        </p>
                        <div className="consecutive-serve-container">
                            <div
                                className={`consecutive-serve ${leftTeam === 'A' ? 'team-a-serve' : 'team-b-serve'}`}
                                style={{
                                    display:
                                        (leftTeam === 'A' && consecutiveScoresA >= 2) ||
                                            (leftTeam === 'B' && consecutiveScoresB >= 2)
                                            ? 'block'
                                            : 'none',
                                }}
                            >
                                {/* 連發 */}
                            </div>
                        </div>
                    </div>

                    <div
                        className={`team team-right ${rightTeam === 'A' ? 'team-a' : 'team-b'}`}
                        onClick={() => incrementScore(rightTeam)}
                    >
                        <h2>隊伍 {rightTeam}</h2>
                        <p className={`score-text score-medium`}>
                            {rightTeam === 'A' ? teamAScore : teamBScore}
                        </p>
                        <div className="consecutive-serve-container">
                            <div
                                className={`consecutive-serve `}
                                style={{
                                    display:
                                        (rightTeam === 'A' && consecutiveScoresA >= 2) ||
                                            (rightTeam === 'B' && consecutiveScoresB >= 2)
                                            ? 'block'
                                            : 'none',
                                }}
                            >
                                {/* 連發 */}
                            </div>
                            {/* <img className="team-img" src='images/common/main_consecutive_serve_blue.png' width={'150px'} alt='I am B' /> */}
                        </div>
                    </div>
                </div>
            </>
        )
    }

    // 頁面:下方按鈕
    let bottomButton;
    bottomButton = (
        <>
            <div className="bottomButtons">
                <button className="mirror-button" onClick={mirrorTeams}>鏡射</button>
                <button className="swap-button" onClick={swapTeams}>互換</button>
                <button onClick={resetScores}>重置</button>
            </div>
        </>
    )

    // 頁面:上方按鈕
    let topButton;
    topButton = (
        <>
            <button className="back-button" onClick={toggleBackOverlay}>
                返回
            </button>
            <div className="top-right-buttons">
                <button className="undo-button" onClick={undoLastAction} disabled={history.length === 0}>
                    回復
                </button>
                {/* <button className="settings-button" onClick={toggleSettings}>
                    設定
                </button> */}
            </div>

            <h1 className="scoreboard-title">
                {mode === 'online' && roomKey ? `(房間: ${roomKey})` : ''}
            </h1>
        </>
    )

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
    let sprinkles;
    sprinkles = (
        <>
            <div className={`confetti-container ${gameStarted ? '' : 'active'}`}>
                {[...Array(50)].map((_, i) => (
                    <div
                        key={i}
                        className="confetti-piece"
                        style={{
                            left: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 2}s`,
                            backgroundColor: `hsl(${Math.random() * 360}, 70%, 50%)`,
                        }}
                    />
                ))}
            </div>
        </>
    )

    // 倒數框
    let countdownBox;
    if (countdown !== null && countdown > 0) {
        countdownBox = (
            <>
                <div className="countdown-overlay">
                    <div className="countdown-box">
                        <span>{countdown}</span>
                    </div>
                </div>
            </>
        )
    }

    // 首次選擇先攻隊伍(先不管這裡了)
    let firstSelectPage;
    if (!gameStarted && firstServe === null) {
        firstSelectPage = (
            <>
                <div className="select-serve">
                    <h2>選擇先攻隊伍</h2>
                    <div className="serve-buttons">
                        <button
                            className={`serve-button team-a ${firstServe === 'A' ? 'highlight' : ''}`}
                            onClick={() => selectFirstServe('A')}
                        >
                            紅方 (隊伍 A)
                        </button>
                        <button
                            className={`serve-button team-b ${firstServe === 'B' ? 'highlight' : ''}`}
                            onClick={() => selectFirstServe('B')}
                        >
                            藍方 (隊伍 B)
                        </button>
                    </div>
                </div>
            </>
        )

    }

    // 頁面:結算畫面 主要處理這塊
    let showWinPage;
    if (!gameStarted && winner) {
        showWinPage = (
            <>
                <div className="select-serve">
                    <div className="victory-message">
                        <div className="final-score-container">
                            <div className="final-score team-a-score">
                                <span className={`${leftTeam === 'A' ? 'team-a-text' : 'team-b-text'}`}>
                                    {leftTeam === 'A' ? winner === 'A' ? finalScoreA + 1 : finalScoreA : winner === 'B' ? finalScoreB + 1 : finalScoreB}
                                </span>
                                {/* 皇冠 */}
                                {leftTeam === 'A' ? winner === 'A' && (
                                    <div className="crown-label team-a-crown">
                                        <svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <defs>
                                                <linearGradient id="goldGradient" x1="0" y1="0" x2="64" y2="48" gradientUnits="userSpaceOnUse">
                                                    <stop offset="0%" stop-color="#f9d423" />
                                                    <stop offset="50%" stop-color="#ffecb3" />
                                                    <stop offset="100%" stop-color="#f9a825" />
                                                </linearGradient>
                                            </defs>
                                            <path d="M4 12L16 36L32 8L48 36L60 12L56 40H8L4 12Z" fill="url(#goldGradient)" stroke="#ffd700" stroke-width="2" />
                                        </svg>
                                    </div>
                                ) : winner === 'B' && (
                                    <div className="crown-label team-b-crown">
                                        <svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <defs>
                                                <linearGradient id="goldGradient" x1="0" y1="0" x2="64" y2="48" gradientUnits="userSpaceOnUse">
                                                    <stop offset="0%" stop-color="#f9d423" />
                                                    <stop offset="50%" stop-color="#ffecb3" />
                                                    <stop offset="100%" stop-color="#f9a825" />
                                                </linearGradient>
                                            </defs>
                                            <path d="M4 12L16 36L32 8L48 36L60 12L56 40H8L4 12Z" fill="url(#goldGradient)" stroke="#ffd700" stroke-width="2" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            <span> : </span>
                            <div className="final-score team-b-score">
                                <span className={`${leftTeam === 'A' ? 'team-b-text' : 'team-a-text'}`}>
                                    {leftTeam === 'A' ? winner === 'B' ? finalScoreB + 1 : finalScoreB : winner === 'A' ? finalScoreA + 1 : finalScoreA}
                                </span>
                                {/* 皇冠 */}
                                {leftTeam === 'A' ? winner === 'B' && (
                                    <div className="crown-label team-b-crown"><svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <defs>
                                            <linearGradient id="goldGradient" x1="0" y1="0" x2="64" y2="48" gradientUnits="userSpaceOnUse">
                                                <stop offset="0%" stop-color="#f9d423" />
                                                <stop offset="50%" stop-color="#ffecb3" />
                                                <stop offset="100%" stop-color="#f9a825" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M4 12L16 36L32 8L48 36L60 12L56 40H8L4 12Z" fill="url(#goldGradient)" stroke="#ffd700" stroke-width="2" />
                                    </svg></div>
                                ) : winner === 'A' && (
                                    <div className="crown-label team-a-crown"><svg width="40" height="30" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <defs>
                                            <linearGradient id="goldGradient" x1="0" y1="0" x2="64" y2="48" gradientUnits="userSpaceOnUse">
                                                <stop offset="0%" stop-color="#f9d423" />
                                                <stop offset="50%" stop-color="#ffecb3" />
                                                <stop offset="100%" stop-color="#f9a825" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M4 12L16 36L32 8L48 36L60 12L56 40H8L4 12Z" fill="url(#goldGradient)" stroke="#ffd700" stroke-width="2" />
                                    </svg></div>
                                )}
                            </div>
                        </div>
                        <p className="play-again-text">再來一局嗎？</p>
                    </div>

                    {/* 選擇選項 */}
                    {isGameEndInitiator ? (
                        <>
                            <div className="serve-choose-text">
                                <h2>選擇先攻隊伍</h2>
                            </div>
                            {
                                leftTeam === 'A' ? <div className="serve-buttons">
                                    <button
                                        className={`serve-button team-a ${firstServe === 'A' ? 'highlight' : ''}`}
                                        onClick={() => selectFirstServe('A')}
                                    >
                                        紅方
                                    </button>
                                    <button
                                        className={`serve-button team-b ${firstServe === 'B' ? 'highlight' : ''}`}
                                        onClick={() => selectFirstServe('B')}
                                    >
                                        藍方
                                    </button>
                                </div>
                                    :
                                    <div className="serve-buttons">
                                        <button
                                            className={`serve-button team-b ${firstServe === 'B' ? 'highlight' : ''}`}
                                            onClick={() => selectFirstServe('B')}
                                        >
                                            藍方
                                        </button>
                                        <button
                                            className={`serve-button team-a ${firstServe === 'A' ? 'highlight' : ''}`}
                                            onClick={() => selectFirstServe('A')}
                                        >
                                            紅方
                                        </button>
                                    </div>
                            }

                        </>
                    ) : (
                        <p className="waiting-message">等待房主選擇先攻隊伍...</p>
                    )}
                </div>
            </>
        )
    }


    // 渲染
    return (
        <div className={`app ${theme}`}>



            {/* 上一頁頁面 */}
            {previousPage}

            {/* 設定頁面 */}
            {settingsPage}

            {/* 特效頁面:灑彩帶 */}
            {sprinkles}

            {/* 結算畫面 */}
            {showWinPage}

            {/* 首次選擇先攻畫面 */}
            {firstSelectPage}

            {/* 轉跳後倒數 */}
            {/* {countdownBox} */}

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