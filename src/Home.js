import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE } from './config';
import './Home.css';

function Home() {
    const [showOnlineOptions, setShowOnlineOptions] = useState(false);
    const [roomKey, setRoomKey] = useState('');
    const [showJoinInput, setShowJoinInput] = useState(false); // 按「加入房間」後才出現輸入框
    const [joining, setJoining] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const handledLink = useRef(false);

    // 分享連結 / QR code：/?room=12345 直接加入房間
    useEffect(() => {
        const linkedRoom = searchParams.get('room');
        if (!linkedRoom || handledLink.current) return;
        handledLink.current = true;
        joinRoom(linkedRoom);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleBadmintonClick = () => {
        setShowOnlineOptions(true);
    };

    const handleSinglePlayer = () => {
        navigate('/scoreboard', { state: { mode: 'single' } });
    };

    const handleCreateRoom = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/create-room`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const { roomKey } = await response.json();
            navigate('/scoreboard', { state: { mode: 'online', roomKey } });
        } catch (error) {
            console.error('Error creating room:', error);
            alert('無法創建房間，請稍後再試！');
        }
    };

    // 進入羽球房間
    const joinRoom = async (key) => {
        if (!(key.length === 5 && /^\d+$/.test(key))) {
            alert('請輸入有效的 5 碼數字房間金鑰！');
            return;
        }
        if (joining) return;
        setJoining(true);
        try {
            const response = await fetch(`${API_BASE}/api/room-state?room=${key}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            navigate('/scoreboard', { replace: true, state: { mode: 'online', roomKey: key } });
        } catch (error) {
            console.error('Error joining room:', error);
            alert('無法加入房間，請確認房間金鑰是否正確（房間閒置太久會被關閉）！');
        } finally {
            setJoining(false);
        }
    };

    // 只留數字；輸滿 5 碼就自動加入，不用再按按鈕
    const handleRoomKeyChange = (e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 5);
        setRoomKey(digits);
        if (digits.length === 5) joinRoom(digits);
    };

    // 羽球選擇頁面
    let badmintonPage;
    if (showOnlineOptions) {
        badmintonPage = (
            <>
                <div className="online-options">
                    <button onClick={handleCreateRoom}>創建房間</button>
                    {showJoinInput ? (
                        <div className="join-room">
                            <input
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                autoFocus
                                placeholder="輸入 5 碼房號"
                                value={roomKey}
                                onChange={handleRoomKeyChange}
                                onKeyDown={(e) => e.key === 'Enter' && joinRoom(roomKey)}
                                maxLength={5}
                            />
                            <div className="join-actions">
                                <button onClick={() => joinRoom(roomKey)} disabled={joining}>加入</button>
                                <button className="secondary" onClick={() => { setShowJoinInput(false); setRoomKey(''); }}>取消</button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setShowJoinInput(true)}>加入房間</button>
                    )}
                </div>

                <button onClick={handleSinglePlayer}>單機計分</button>
                <button className="link-button" onClick={() => navigate('/history')}>所有歷史紀錄</button>
            </>
        )
    }

    // 主頁按鈕區
    let mainPage;
    if (!showOnlineOptions) {
        mainPage = (
            <>
                <button onClick={handleBadmintonClick}>羽毛球</button>
                <button onClick={handleBadmintonClick} disabled>籃球</button>
                <button onClick={handleBadmintonClick} disabled>兩隊自訂</button>
                <button onClick={handleBadmintonClick} disabled>多人桌游</button>
            </>
        )
    }

    return (
        <div className="home">
            <h1>線上連線計分版</h1>

            {mainPage}

            {badmintonPage}
        </div>
    );
}

export default Home;