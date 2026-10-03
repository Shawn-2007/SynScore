import React from 'react';
import './History.css';

export const TEAM_NAME = { A: '紅方', B: '藍方' };

const pad = (n) => String(n).padStart(2, '0');

export const dayKey = (t) => {
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

// 一場比賽的結果；extra 是附加說明（例如房號），onDelete 有給才顯示刪除鈕
export function ResultItem({ result, extra, onDelete }) {
    return (
        <div className="history-item">
            <div className="history-score">
                <span className={`team-a-text ${result.winner === 'A' ? 'win' : ''}`}>{result.teamAScore}</span>
                <span> : </span>
                <span className={`team-b-text ${result.winner === 'B' ? 'win' : ''}`}>{result.teamBScore}</span>
            </div>
            <div className="history-meta">
                <div>
                    {TEAM_NAME[result.winner]}勝
                    {result.firstServe ? `・${TEAM_NAME[result.firstServe]}先攻` : ''}
                </div>
                <div className="history-sub">
                    {timeText(result.endedAt)}
                    {durationText(result) ? `・${durationText(result)}` : ''}
                    {extra ? `・${extra}` : ''}
                </div>
            </div>
            {onDelete && (
                <button className="history-delete" onClick={onDelete} aria-label="刪除這場紀錄">✕</button>
            )}
        </div>
    );
}
