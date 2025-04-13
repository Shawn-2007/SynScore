import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
    const [showOptions, setShowOptions] = useState(false);
    const [showOnlineOptions, setShowOnlineOptions] = useState(false);
    const [roomKey, setRoomKey] = useState('');
    const navigate = useNavigate();

    const handleBadmintonClick = () => {
        setShowOptions(true);
    };

    const handleSinglePlayer = () => {
        navigate('/scoreboard', { state: { mode: 'single' } });
    };

    const handleOnlineClick = () => {
        setShowOptions(false);
        setShowOnlineOptions(true);
    };

    const handleCreateRoom = async () => {
        const response = await fetch('http://localhost:3001/api/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const { roomKey } = await response.json();
        navigate('/scoreboard', { state: { mode: 'online', roomKey } });
    };

    const handleJoinRoom = () => {
        if (roomKey.length === 5 && /^\d+$/.test(roomKey)) {
            navigate('/scoreboard', { state: { mode: 'online', roomKey } });
        } else {
            alert('請輸入有效的 5 碼數字房間金鑰！');
        }
    };

    return (
        <div className="home">
            <h1>羽球計分系統</h1>
            {!showOptions && !showOnlineOptions && (
                <button onClick={handleBadmintonClick}>羽球</button>
            )}
            {showOptions && (
                <div className="options">
                    <button onClick={handleSinglePlayer}>單機計分</button>
                    <button onClick={handleOnlineClick}>線上計分</button>
                </div>
            )}
            {showOnlineOptions && (
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
            )}
        </div>
    );
}

export default Home;