import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Scoreboard.css';

function Scoreboard() {
    const [teamAScore, setTeamAScore] = useState(0);
    const [teamBScore, setTeamBScore] = useState(0);
    const [gameScoreA, setGameScoreA] = useState(0);
    const [gameScoreB, setGameScoreB] = useState(0);
    const [isSwapped, setIsSwapped] = useState(false);
    const location = useLocation();
    const { mode, roomKey } = location.state || { mode: 'single', roomKey: null };

    // WebSocket 連線（僅在線上模式下使用）
    useEffect(() => {
        if (mode !== 'online' || !roomKey) return;

        let ws;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 5;
        const reconnectInterval = 2000; // 每 2 秒重試一次

        const connectWebSocket = () => {
            ws = new WebSocket(`ws://localhost:3001?room=${roomKey}`);

            ws.onopen = () => {
                console.log(`Connected to WebSocket server (Room: ${roomKey})`);
                reconnectAttempts = 0; // 重置重試次數
            };

            ws.onmessage = (event) => {
                console.log('Received WebSocket message:', event.data);
                const data = JSON.parse(event.data);
                setTeamAScore(data.teamAScore);
                setTeamBScore(data.teamBScore);
                setGameScoreA(data.gameScoreA);
                setGameScoreB(data.gameScoreB);
            };

            ws.onclose = () => {
                console.log('Disconnected from WebSocket server');
                if (reconnectAttempts < maxReconnectAttempts) {
                    console.log(`Reconnecting in ${reconnectInterval / 1000} seconds... (Attempt ${reconnectAttempts + 1})`);
                    setTimeout(connectWebSocket, reconnectInterval);
                    reconnectAttempts++;
                } else {
                    console.log('Max reconnect attempts reached. Please refresh the page.');
                }
            };

            ws.onerror = (error) => {
                console.log('WebSocket error:', error);
            };
        };

        connectWebSocket();

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [mode, roomKey]);

    // 增加指定隊伍的得分
    const incrementScore = async (team) => {
        console.log(`Clicked team: ${team}`);
        console.log(`Current scores - A: ${teamAScore}, B: ${teamBScore}`);

        let newTeamAScore = team === 'A' ? teamAScore + 1 : teamAScore;
        let newTeamBScore = team === 'B' ? teamBScore + 1 : teamBScore;
        let newGameScoreA = gameScoreA;
        let newGameScoreB = gameScoreB;

        if (newTeamAScore >= 21) {
            newGameScoreA = gameScoreA + 1;
            newTeamAScore = 0;
            newTeamBScore = 0;
        } else if (newTeamBScore >= 21) {
            newGameScoreB = gameScoreB + 1;
            newTeamAScore = 0;
            newTeamBScore = 0;
        }

        if (mode === 'online' && roomKey) {
            console.log('Sending update to backend:', {
                roomKey,
                teamAScore: newTeamAScore,
                teamBScore: newTeamBScore,
                gameScoreA: newGameScoreA,
                gameScoreB: newGameScoreB,
            });
            try {
                const response = await fetch('http://localhost:3001/api/update-score', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        teamAScore: newTeamAScore,
                        teamBScore: newTeamBScore,
                        gameScoreA: newGameScoreA,
                        gameScoreB: newGameScoreB,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                console.log('Backend response:', result);
            } catch (error) {
                console.error('Error sending update to backend:', error);
            }
        } else {
            setTeamAScore(newTeamAScore);
            setTeamBScore(newTeamBScore);
            setGameScoreA(newGameScoreA);
            setGameScoreB(newGameScoreB);
        }
    };

    const resetScores = async () => {
        if (mode === 'online' && roomKey) {
            try {
                const response = await fetch('http://localhost:3001/api/update-score', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        roomKey,
                        teamAScore: 0,
                        teamBScore: 0,
                        gameScoreA: 0,
                        gameScoreB: 0,
                    }),
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            } catch (error) {
                console.error('Error resetting scores:', error);
            }
        } else {
            setTeamAScore(0);
            setTeamBScore(0);
            setGameScoreA(0);
            setGameScoreB(0);
        }
    };

    const swapTeams = () => {
        setIsSwapped(!isSwapped);
    };

    const leftTeam = isSwapped ? 'B' : 'A';
    const rightTeam = isSwapped ? 'A' : 'B';

    return (
        <div className="app">
            <h1>羽球記分板 {mode === 'online' && roomKey ? `(房間: ${roomKey})` : ''}</h1>
            <div className="game-score">
                <span>{gameScoreA} : {gameScoreB}</span>
            </div>
            <div className="scoreboard">
                <div
                    className={`team team-left ${leftTeam === 'A' ? 'team-a' : 'team-b'}`}
                    onClick={() => incrementScore(leftTeam)}
                >
                    <h2>隊伍 {leftTeam}</h2>
                    <p>{leftTeam === 'A' ? teamAScore : teamBScore}</p>
                </div>
                <div
                    className={`team team-right ${rightTeam === 'A' ? 'team-a' : 'team-b'}`}
                    onClick={() => incrementScore(rightTeam)}
                >
                    <h2>隊伍 {rightTeam}</h2>
                    <p>{rightTeam === 'A' ? teamAScore : teamBScore}</p>
                </div>
            </div>
            <div className="buttons">
                <button onClick={swapTeams}>切換</button>
                <button onClick={resetScores}>重置</button>
            </div>
        </div>
    );
}

export default Scoreboard;