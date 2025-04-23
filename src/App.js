import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from './Home';
import Scoreboard from './Scoreboard';

function App() {
  return (
    <Router basename="/SynScore">
      {/* <Router> */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
        {/* 處理所有未匹配的路由，重定向到主頁 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>


  );
}

export default App;
