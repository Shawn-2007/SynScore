import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
    const [showOnlineOptions, setShowOnlineOptions] = useState(false);
    const [roomKey, setRoomKey] = useState('');
    const navigate = useNavigate();

    const handleBadmintonClick = () => {
        setShowOnlineOptions(true);
    };

    const handleSinglePlayer = () => {
        navigate('/scoreboard', { state: { mode: 'single' } });
    };

    const handleCreateRoom = async () => {
        const response = await fetch('https://api.shawn4x4.com/nodeApi/api/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const { roomKey } = await response.json();
        navigate('/scoreboard', { state: { mode: 'online', roomKey } });
    };

    // 進入羽球房間
    const handleJoinRoom = () => {
        if (roomKey.length === 5 && /^\d+$/.test(roomKey)) {
            navigate('/scoreboard', { state: { mode: 'online', roomKey } });
        } else {
            alert('請輸入有效的 5 碼數字房間金鑰！');
        }
    };

    // 羽球選擇頁面
    let badmintonPage;
    if (showOnlineOptions) {
        badmintonPage = (
            <>
                <div className="online-options">
                    <button onClick={handleCreateRoom}>創建房間</button>
                    <div className="join-room">
                        <input
                            type="text"
                            placeholder="輸入 5 碼房間金鑰"
                            value={roomKey}
                            onChange={(e) => setRoomKey(e.target.value)}
                            maxLength={5}
                        />
                        <button onClick={handleJoinRoom}>加入房間</button>
                    </div>
                </div>

                <button onClick={handleSinglePlayer}>單機計分</button>
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