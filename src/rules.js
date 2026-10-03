// 羽球計分規則（單一事實來源）。
// 注意：badminton-scoreboard/src/rules.js 是此檔的副本（CRA 不能 import src 以外的檔案），修改時請兩邊同步。
//
// 規則：21 分制；20 平後需領先 2 分；29 平時先得 30 分者勝。

const WIN_SCORE = 21;
const MAX_SCORE = 30;
const MAX_RESULTS = 200; // 保留的歷史場次上限

const otherTeam = (team) => (team === 'A' ? 'B' : 'A');

// 回傳 'A' | 'B' | null
function checkWinner(a, b) {
    if (a >= MAX_SCORE) return 'A';
    if (b >= MAX_SCORE) return 'B';
    if (a >= WIN_SCORE && a - b >= 2) return 'A';
    if (b >= WIN_SCORE && b - a >= 2) return 'B';
    return null;
}

function createGame() {
    return {
        teamAScore: 0,
        teamBScore: 0,
        servingTeam: null,
        firstServe: null,
        isGameStarted: false,
        swapTeams: false,
        consecutiveA: 0, // 連續得分（最多 2），>= 2 時顯示連發標示
        consecutiveB: 0,
        // 雙打站位追蹤：開局站右邊的人叫「雙」、站左邊的叫「單」。
        // 發球方得分時兩位隊友換位（同一人再發），接發球方得分則不換位；flip 為 true 表示該隊目前「單」站右邊。
        flipA: false,
        flipB: false,
        serveRoll: 0,
        winner: null,
        startedAt: null,
        results: [], // 已完成的場次：{ startedAt, endedAt, teamAScore, teamBScore, winner, firstServe }
        history: [], // 撤銷用（比賽結束後仍保留，可回復誤按的最後一分）
    };
}

// team 可為 'A' | 'B' | 'random'。先發球方一開始視為連發，另一方為 1
function startGame(game, team, now = Date.now(), random = Math.random) {
    if (game.isGameStarted) return game;
    if (team === 'random') team = random() < 0.5 ? 'A' : 'B';
    return {
        ...game,
        teamAScore: 0,
        teamBScore: 0,
        servingTeam: team,
        firstServe: team,
        isGameStarted: true,
        consecutiveA: team === 'A' ? 2 : 1,
        consecutiveB: team === 'B' ? 2 : 1,
        flipA: false,
        flipB: false,
        winner: null,
        startedAt: now,
        history: [],
    };
}

// 開局後、第一分之前（0:0）可以改先攻方；team 可為 'A' | 'B' | 'random'
function setFirstServe(game, team, random = Math.random) {
    if (!game.isGameStarted || game.history.length > 0) return game;
    const isRandom = team === 'random';
    if (team === 'random') team = random() < 0.5 ? 'A' : 'B';
    return {
        ...game,
        servingTeam: team,
        firstServe: team,
        serveRoll: (game.serveRoll || 0) + (isRandom ? 1 : 0),
        consecutiveA: team === 'A' ? 2 : 1,
        consecutiveB: team === 'B' ? 2 : 1,
    };
}

function applyPoint(game, team, now = Date.now()) {
    if (!game.isGameStarted) return game;

    const snapshot = {
        teamAScore: game.teamAScore,
        teamBScore: game.teamBScore,
        servingTeam: game.servingTeam,
        consecutiveA: game.consecutiveA,
        consecutiveB: game.consecutiveB,
        flipA: game.flipA,
        flipB: game.flipB,
    };

    const teamAScore = game.teamAScore + (team === 'A' ? 1 : 0);
    const teamBScore = game.teamBScore + (team === 'B' ? 1 : 0);
    const next = {
        ...game,
        teamAScore,
        teamBScore,
        servingTeam: team,
        consecutiveA: team === 'A' ? Math.min(game.consecutiveA + 1, 2) : 0,
        consecutiveB: team === 'B' ? Math.min(game.consecutiveB + 1, 2) : 0,
        // 只有「發球方得分」才換位
        flipA: team === 'A' && game.servingTeam === 'A' ? !game.flipA : game.flipA,
        flipB: team === 'B' && game.servingTeam === 'B' ? !game.flipB : game.flipB,
        history: [...game.history, snapshot],
    };

    const winner = checkWinner(teamAScore, teamBScore);
    if (!winner) return next;

    // 比賽結束：保留最終比分與歷史（可回復），並記錄這一場
    const result = {
        startedAt: game.startedAt,
        endedAt: now,
        teamAScore,
        teamBScore,
        winner,
        firstServe: game.firstServe,
    };
    return {
        ...next,
        winner,
        isGameStarted: false,
        servingTeam: null,
        consecutiveA: 0,
        consecutiveB: 0,
        results: [...game.results, result].slice(-MAX_RESULTS),
    };
}

// 回復上一分；若上一分剛好結束了比賽，則回到比賽中並移除該場紀錄
function undo(game) {
    if (game.history.length === 0) return game;
    const last = game.history[game.history.length - 1];
    return {
        ...game,
        ...last,
        isGameStarted: true,
        winner: null,
        results: game.winner ? game.results.slice(0, -1) : game.results,
        history: game.history.slice(0, -1),
    };
}

// 全新的一局（0:0 直接開始）：保留左右互換設定與已完成的歷史場次
function newGame(game, firstServe = 'A', now = Date.now()) {
    return startGame({ ...createGame(), swapTeams: game.swapTeams, results: game.results }, firstServe, now);
}

// 重置：放棄目前這一局，從 0:0 重新開始（沿用原本的先攻方）
function resetGame(game) {
    return newGame(game, game.firstServe || 'A');
}

// 目前發球／接發球的場地與球員（雙打）。court 為 'right' | 'left'（各隊自己的右、左發球區）；
// player 為 'even'（開局站右邊的「雙」）或 'odd'（開局站左邊的「單」）。未開局時回傳 null。
function serveInfo(game) {
    if (!game.isGameStarted || !game.servingTeam) return null;
    const serverTeam = game.servingTeam;
    const receiverTeam = otherTeam(serverTeam);
    const serverScore = serverTeam === 'A' ? game.teamAScore : game.teamBScore;
    const court = serverScore % 2 === 0 ? 'right' : 'left';
    const playerAt = (team, c) => {
        const flipped = team === 'A' ? game.flipA : game.flipB;
        const rightPlayer = flipped ? 'odd' : 'even';
        if (c === 'right') return rightPlayer;
        return rightPlayer === 'even' ? 'odd' : 'even';
    };
    return {
        serverTeam,
        receiverTeam,
        court,
        serverPlayer: playerAt(serverTeam, court),
        receiverPlayer: playerAt(receiverTeam, court), // 接發球員站在對角，也就是同一側的發球區
    };
}

function setSwap(game, swapTeams) {
    return { ...game, swapTeams: !!swapTeams };
}

// 對外狀態：不含完整歷史，只告知能否撤銷。可重複呼叫。
function toView(game) {
    if (!game.history) return game;
    const { history, ...rest } = game;
    return { ...rest, canUndo: history.length > 0 };
}

module.exports = {
    checkWinner,
    createGame,
    startGame,
    newGame,
    setFirstServe,
    applyPoint,
    undo,
    resetGame,
    setSwap,
    serveInfo,
    toView,
    otherTeam,
};
