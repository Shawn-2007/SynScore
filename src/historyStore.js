// 歷史紀錄：存在這支手機的 localStorage。
// 以「房間」為單位鏡像後端的 results（後端撤銷誤按的結束時，該場也會從 results 消失）。
// 使用者刪除的紀錄記在 deleted，之後同步時不會再被補回來。
const STORAGE_KEY = 'synscore-history';
const MAX_DELETED = 1000;

function load() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (data && data.rooms) return { rooms: data.rooms, deleted: data.deleted || [] };
    } catch (error) {
        // 讀不到就當作空的
    }
    return { rooms: {}, deleted: [] };
}

function save(data) {
    try {
        data.deleted = data.deleted.slice(-MAX_DELETED);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        // 儲存空間不可用時忽略
    }
}

const recordId = (roomId, result) => `${roomId}:${result.endedAt}`;

// 鏡像某個房間（或單機 'local'）目前的 results
export function syncResults(roomId, results) {
    const data = load();
    const visible = (results || []).filter((r) => !data.deleted.includes(recordId(roomId, r)));
    if (JSON.stringify(data.rooms[roomId] || []) === JSON.stringify(visible)) return;
    if (visible.length === 0) delete data.rooms[roomId];
    else data.rooms[roomId] = visible;
    save(data);
}

// 所有紀錄，新的在前
export function getAllRecords() {
    const { rooms } = load();
    return Object.entries(rooms)
        .flatMap(([roomId, results]) =>
            results.map((result) => ({
                ...result,
                id: recordId(roomId, result),
                online: roomId !== 'local',
                roomKey: roomId.startsWith('room-') ? roomId.split('-')[1] : null,
            }))
        )
        .sort((a, b) => b.endedAt - a.endedAt);
}

export function deleteRecord(id) {
    const data = load();
    data.deleted.push(id);
    Object.keys(data.rooms).forEach((roomId) => {
        data.rooms[roomId] = data.rooms[roomId].filter((r) => recordId(roomId, r) !== id);
        if (data.rooms[roomId].length === 0) delete data.rooms[roomId];
    });
    save(data);
}

export function clearAllRecords() {
    const data = load();
    getAllRecords().forEach((r) => data.deleted.push(r.id));
    data.rooms = {};
    save(data);
}
