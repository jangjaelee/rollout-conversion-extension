import * as React from 'react';
import { useEffect, useStatem, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

((window) => {
  const { createElement, useMemo } = React;

  const convertDeploymentToRollout = (deployment) => {
    if (deployment.kind !== "Deployment") return null;

    const rollout = JSON.parse(JSON.stringify(deployment));
    rollout.apiVersion = "argoproj.io/v1alpha1";
    rollout.kind = "Rollout";

    rollout.spec.strategy = {
      canary: {
        steps: [
          { setWeight: 20 },
          { pause: { duration: '30s' } },
          { setWeight: 50 },
          { pause: { duration: '1m' } },
        ]
      }
    };

    // 불필요한 필드 제거
    delete rollout.spec.revisionHistoryLimit;
    delete rollout.spec.progressDeadlineSeconds;

    return rollout;
  };

  const RolloutConverter = ({ resource }) => {
    const rolloutYaml = useMemo(() => {
      const rollout = convertDeploymentToRollout(resource);
      if (!rollout) {
        return "# Not a Deployment resource";
      }
      return window.jsyaml.dump(rollout);
    }, [resource]);

    return createElement(
      'pre',
      {
        style: {
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          backgroundColor: '#f5f5f5',
          padding: '1em',
          borderRadius: '8px'
        }
      },
      rolloutYaml
    );
  };

  window.extensionsAPI?.registerResourceExtension?.(
    RolloutConverter,
    'Deployment',
    'apps',
    'Convert to Rollout'
  );
})(window);