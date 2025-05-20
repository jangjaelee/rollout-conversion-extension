// src/utils/ToggleSwitch.js

import React from 'react';
import './ToggleSwitch.css';

const ToggleSwitch = ({ isChecked, onToggle, label }) => {
  return (
    <label className="toggle-switch">
      <input type="checkbox" checked={isChecked} onChange={onToggle} />
      <span className="slider"></span>
      <span className="switch-label">{label}</span>
    </label>
  );
};

export default ToggleSwitch;