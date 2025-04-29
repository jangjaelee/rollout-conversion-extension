// src/utils/convertDeployment.js

// Rollout API Template
export const convertDeploymentToRollout = ({ deployment, steps, mode, strategy }) => {
  //const { deployment, steps } = props;
  if (!deployment) return null;

  // strategy가 canary일 때만 steps 존재 여부를 확인
  if (strategy === 'canary' && !steps) return null;

  const rolloutTemplate = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Rollout',
    metadata: {
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      labels: {
        ...(deployment.metadata.labels || {}),
        'converted-by': 'rollout-conversion-extension',
      },
      annotations: deployment.metadata.annotations,
    },
    spec: {
      replicas: deployment.spec.replicas,
      revisionHistoryLimit: deployment.spec.revisionHistoryLimit,
      selector: deployment.spec.selector,
    },
  };

  // strategy 별로 spec.strategy 다르게 구성 (canary or blue/green)
  if (strategy === 'canary') {
    rolloutTemplate.spec.strategy = {
      canary: {
        canaryService: 'canary-service',
        stableService: 'stable-service',
        canaryMetadata: {
          annotations: { role: 'canary' },
          labels: { role: 'canary' },
        },
        stableMetadata: {
          annotations: { role: 'stable' },
          labels: { role: 'stable' },
        },
        steps: steps || [],
        trafficRouting: {
          plugins: {
            'argoproj-labs/gatewayAPI': {
              httpRoute: 'claim-api-test-public',
              namespace: 'dev-claim',
            },
          },
        },
        abortScaleDownDelaySeconds: 30,
        dynamicStableScale: false,
      },
    };
  } else if (strategy === 'blueGreen') {
    rolloutTemplate.spec.strategy = {
      blueGreen: {
        activeService: 'stable-service',
        previewService: 'bluegreen-service',
        autoPromotionEnabled: false,
        scaleDownDelaySeconds: 30,
        abortScaleDownDelaySeconds: 30,        
        previewMetadata: {
          labels: { role: 'bluegreen' },
        },
        activeMetadata: {
          labels: { role: 'stable' },
        },
      },
    };
  };

  // Canary 배포 전략에서 workloadRef 모드일 경우
  if (mode === 'workloadRef') {
    rolloutTemplate.spec.workloadRef = {
        apiVersion: deployment.apiVersion,
        kind: deployment.kind,
        name: deployment.metadata.name,
        scaleDown: "onsuccess",
    };
  // Canary 배포 전략에서 template 모드일 경우
  } else {
    rolloutTemplate.spec.template = deployment.spec.template;
  };

  return rolloutTemplate;
};