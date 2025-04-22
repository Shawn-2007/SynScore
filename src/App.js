import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './Home';
import Scoreboard from './Scoreboard';

function App() {
  return (
    <Router basename="/SynScore">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/scoreboard" element={<Scoreboard />} />
      </Routes>
    </Router>


  );
}

export default App;
