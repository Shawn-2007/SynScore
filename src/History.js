import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllRecords, deleteRecord, clearAllRecords } from './historyStore';
import { ResultItem, dayKey } from './ResultList';
import './History.css';

// 這支手機上所有房間（含單機）的歷史紀錄
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
                <h1>所有歷史紀錄</h1>
                {records.length > 0 ? <button className="danger" onClick={handleClear}>清除全部</button> : <span />}
            </div>

            {records.length === 0 && <p className="history-empty">還沒有紀錄。打完一場就會自動出現在這裡。</p>}

            {groups.map((group) => (
                <section key={group.day} className="history-group">
                    <h2>{group.day}（{group.items.length} 場）</h2>
                    {group.items.map((r) => (
                        <ResultItem
                            key={r.id}
                            result={r}
                            extra={r.online ? `房間 ${r.roomKey}` : '單機'}
                            onDelete={() => handleDelete(r.id)}
                        />
                    ))}
                </section>
            ))}
        </div>
    );
}

export default History;
