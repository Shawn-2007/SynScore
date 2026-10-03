import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRecords, deleteRecord, clearAllRecords } from './historyStore';
import './History.css';

const TEAM_NAME = { A: '紅方', B: '藍方' };

const pad = (n) => String(n).padStart(2, '0');
const dayKey = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
};
const timeText = (t) => {
    const d = new Date(t);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const durationText = (r) => {
    if (!r.startedAt) return '';
    const minutes = Math.max(1, Math.round((r.endedAt - r.startedAt) / 60000));
    return `${minutes} 分鐘`;
};

function History() {
    const navigate = useNavigate();
    const [records, setRecords] = useState(getAllRecords);

    const handleDelete = (id) => {
        deleteRecord(id);
        setRecords(getAllRecords());
    };

    const handleClear = () => {
        if (window.confirm('確定要清除這支手機上的所有歷史紀錄嗎？')) {
            clearAllRecords();
            setRecords([]);
        }
    };

    // 依日期分組（records 已由新到舊排序）
    const groups = [];
    records.forEach((record) => {
        const day = dayKey(record.endedAt);
        const last = groups[groups.length - 1];
        if (last && last.day === day) last.items.push(record);
        else groups.push({ day, items: [record] });
    });

    return (
        <div className="history-page">
            <div className="history-header">
                <button onClick={() => navigate('/')}>返回首頁</button>
                <h1>歷史紀錄</h1>
                {records.length > 0 ? <button className="danger" onClick={handleClear}>清除全部</button> : <span />}
            </div>

            {records.length === 0 && <p className="history-empty">還沒有紀錄。打完一場就會自動出現在這裡。</p>}

            {groups.map((group) => (
                <section key={group.day} className="history-group">
                    <h2>{group.day}（{group.items.length} 場）</h2>
                    {group.items.map((r) => (
                        <div key={r.id} className="history-item">
                            <div className="history-score">
                                <span className={`team-a-text ${r.winner === 'A' ? 'win' : ''}`}>{r.teamAScore}</span>
                                <span> : </span>
                                <span className={`team-b-text ${r.winner === 'B' ? 'win' : ''}`}>{r.teamBScore}</span>
                            </div>
                            <div className="history-meta">
                                <div>
                                    {TEAM_NAME[r.winner]}勝
                                    {r.firstServe ? `・${TEAM_NAME[r.firstServe]}先攻` : ''}
                                </div>
                                <div className="history-sub">
                                    {timeText(r.endedAt)}
                                    {durationText(r) ? `・${durationText(r)}` : ''}
                                    {r.online ? `・房間 ${r.roomKey}` : '・單機'}
                                </div>
                            </div>
                            <button className="history-delete" onClick={() => handleDelete(r.id)} aria-label="刪除這場紀錄">✕</button>
                        </div>
                    ))}
                </section>
            ))}
        </div>
    );
}

export default History;
