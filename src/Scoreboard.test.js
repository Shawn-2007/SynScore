import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Scoreboard from './Scoreboard';
import { newGame, createGame } from './rules';

// CRA 的 Jest 27 不支援 React Router 7 的 exports；此處只測計分頁互動。
jest.mock('react-router-dom', () => ({
    useLocation: () => ({ state: { mode: 'single' } }),
    useNavigate: () => jest.fn(),
}), { virtual: true });

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('synscore-local-game', JSON.stringify(newGame(createGame(), 'A')));
    jest.useFakeTimers();
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const open = () => render(<Scoreboard />);
const flush = async () => { await act(async () => {}); };

test('單雙球員跟著得分輪轉，回復還原，先攻只在 0:0 的頂列出現', async () => {
    const { container } = open();
    expect(container.querySelector('.scoreboard-header .serve-picker')).not.toBeNull();
    fireEvent.click(container.querySelector('.team-a'));
    await flush();
    expect(screen.getByText('發球・雙')).toBeTruthy();
    expect(screen.getByText('接發・單')).toBeTruthy();
    expect(container.querySelector('.serve-picker')).toBeNull();
    fireEvent.click(container.querySelector('.team-b'));
    await flush();
    expect(screen.getByText('發球・單')).toBeTruthy();
    fireEvent.click(screen.getByText('回復'));
    await flush();
    expect(screen.getByText('發球・雙')).toBeTruthy();
});

test('隨機即使抽到原先隊伍或關閉提示仍播放，期間不加分，停在實際發球區', async () => {
    localStorage.setItem('serveMode', 'off');
    jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const { container } = open();
    fireEvent.click(screen.getByText('🎲 隨機'));
    await flush();
    expect(screen.getByText('🎲 抽籤中').disabled).toBe(true);
    expect(container.querySelectorAll('.serve-half.active')).toHaveLength(1);
    fireEvent.click(container.querySelector('.team-a'));
    expect(container.querySelector('.team-a .score-text').textContent).toBe('0');
    act(() => { jest.advanceTimersByTime(2500); });
    expect(screen.getByText('先攻：紅方')).toBeTruthy();
    expect(screen.getByText('🎲 隨機').disabled).toBe(false);
    fireEvent.click(screen.getByText('🎲 隨機'));
    await flush();
    expect(screen.getByText('🎲 抽籤中')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(2500); });
});

test('鏡射後隨機選藍方仍落在藍方的右發球區', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const { container } = open();
    fireEvent.click(screen.getByText('鏡射'));
    fireEvent.click(screen.getByText('🎲 隨機'));
    await flush();
    act(() => { jest.advanceTimersByTime(2500); });
    expect(container.querySelector('.team-left.team-b .serve-icon.in-bottom')).not.toBeNull();
    expect(screen.getByText('先攻：藍方')).toBeTruthy();
});
