import React from 'react'
import ReactDOM from 'react-dom/client'
import RolloutConvert from './App.js'

/*
((window: any) => {
})(window);
*/

/*
(window?.extensionsAPI?.registerResourceExtension) ?
  window?.extensionsAPI?.registerResourceExtension(
    RolloutConvert,
    'apps',
    'Deployment',
    'Rollout Convert',
    { icon: 'fad fa-exchange' }
  ) : console.warn('extensionsAPI not found');
*/

const resourceTargets = [
  { group: 'apps', kind: 'Deployment' },
  { group: '', kind: 'Service' },
  { group: 'gateway.networking.k8s.io', kind: 'HTTPRoute' },
];

resourceTargets.forEach(({ group, kind }) => {
  window?.extensionsAPI?.registerResourceExtension?.(
    RolloutConvert,
    group,
    kind,
    'Rollout Convert',
    { icon: 'fad fa-exchange' }
  );
});