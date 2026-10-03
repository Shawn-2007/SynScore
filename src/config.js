// 後端位置，可用環境變數覆蓋（REACT_APP_API_BASE / REACT_APP_WS_BASE）
export const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.shawn4x4.com/nodeApi';
export const WS_BASE = process.env.REACT_APP_WS_BASE || 'wss://api.shawn4x4.com/ws/';

// 後端操作：回傳最新房間狀態，失敗時丟出錯誤
export async function postAction(action, body) {
    const response = await fetch(`${API_BASE}/api/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return response.json();
}
