import * as React from 'react';
import { useMemo } from 'react';
import yaml from 'js-yaml';
import './index.css';

((window) => {
  const { createElement } = React;

  const convertDeploymentToRollout = (deployment) => {
    if (!deployment || deployment.kind !== 'Deployment') return null;

    const {
      metadata,
      spec: {
        replicas,
        selector,
        template,
        strategy,
        revisionHistoryLimit,
        progressDeadlineSeconds,
        minReadySeconds,
      },
    } = deployment;

    return {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'Rollout',
      metadata,
      spec: {
        replicas,
        selector,
        template,
        strategy: {
          canary: {
            steps: [
              { setWeight: 20 },
              { pause: { duration: '30s' } },
              { setWeight: 50 },
              { pause: { duration: '1m' } },
            ],
          },
        },
        revisionHistoryLimit,
        progressDeadlineSeconds,
        minReadySeconds,
      },
    };
  };

  const DeploymentYamlViewer = ({ resource }) => {
    const liveYaml = useMemo(() => {
      if (!resource) return "# No live resource available";
      try {
        return yaml.dump(resource);
      } catch {
        return "# Error converting live resource to YAML";
      }
    }, [resource]);

    const rolloutYaml = useMemo(() => {
      try {
        const rollout = convertDeploymentToRollout(resource);
        return rollout ? yaml.dump(rollout) : "# Could not convert Deployment to Rollout";
      } catch {
        return "# Error converting Deployment to Rollout";
      }
    }, [resource]);

    return createElement('div', { className: 'container' }, [
      createElement('div', {}, [
        createElement('h3', {}, 'Live Deployment YAML'),
        createElement('pre', { className: 'yaml-box' }, liveYaml),
      ]),
      createElement('div', { style: { marginTop: '2rem' } }, [
        createElement('h3', {}, 'Converted Rollout YAML'),
        createElement('pre', { className: 'yaml-box' }, rolloutYaml),
      ])
    ]);
  };

  window.extensionsAPI?.registerResourceExtension?.(
    DeploymentYamlViewer,
    'apps',
    'Deployment',
    'YAML Viewer'
  );
})(window);