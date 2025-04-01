import * as React from 'react';
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

((window) => {
  const { useMemo } = React;

  const convertDeploymentToRollout = (deployment) => {
    if (deployment.kind !== "Deployment") return null;

    const rollout = JSON.parse(JSON.stringify(deployment)); // deep copy
    rollout.apiVersion = "argoproj.io/v1alpha1";
    rollout.kind = "Rollout";

    // 기본 Canary 전략 추가
    rollout.spec.strategy = {
      canary: {
        steps: [
          { setWeight: 20 },
          { pause: { duration: "30s" } },
          { setWeight: 50 },
          { pause: { duration: "1m" } },
        ]
      }
    };

    // Deployment에서 Rollout에 필요 없는 필드 제거 (예시)
    delete rollout.spec.revisionHistoryLimit;
    delete rollout.spec.progressDeadlineSeconds;

    return rollout;
  };

  const RolloutConverter = ({ resource }) => {
    const rolloutYaml = useMemo(() => {
      const rollout = convertDeploymentToRollout(resource);
      return rollout
        ? jsyaml.dump(rollout)
        : "# Not a Deployment resource";
    }, [resource]);

    return React.createElement("pre", {
      style: {
        whiteSpace: "pre-wrap",
        fontFamily: "monospace",
        backgroundColor: "#f5f5f5",
        padding: "1em",
        borderRadius: "8px"
      }
    }, rolloutYaml);
  };

  window.extensionsAPI.registerResourceExtension(
    RolloutConverter,
    "Deployment",
    "apps",
    "Convert to Rollout"
  );
})(window);