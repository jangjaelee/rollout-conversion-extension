import React from 'react'
import ReactDOM from 'react-dom/client'
import RolloutConvert from './App.js'


/*
((window: any) => {
})(window);
*/

(window?.extensionsAPI?.registerResourceExtension) ?
  window?.extensionsAPI?.registerResourceExtension(
    RolloutConvert,
    'apps',
    'Deployment',
    'Rollout Convert',
    { icon: 'fad fa-exchange' }
  ) : console.warn('extensionsAPI not found');