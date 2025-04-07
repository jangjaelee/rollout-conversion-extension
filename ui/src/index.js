import { useEffect, useState } from 'react';

import React from 'react'
import ReactDOM from 'react-dom/client'
import RolloutConvert from './App.js'


((window: any) => {
  window?.extensionsAPI?.registerResourceExtension(
    RolloutConvert,
    'apps',
    'Deployment',
    'Rollout Convert',
    {icon: 'fad fa-exchange'}
  );
})(window);