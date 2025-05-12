// src/utils/convertDeployment.js

// Rollout API Template
export const convertDeploymentToRollout = ({ deployment, steps, mode, strategy, httpRoute, namespace, stableServiceName }) => {
  //const { deployment, steps } = props;
  if (!deployment) return null;

  // strategy가 canary일 때만 steps 존재 여부를 확인
  if (strategy === 'canary' && !steps) return null;

  const stable = stableServiceName || 'service';
  const canary = `${stable}-canary`;

  const rolloutTemplate = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Rollout',
    metadata: {
      annotations: deployment.metadata.annotations,
      labels: {
        ...(deployment.metadata.labels || {}),
        'converted-by': 'rollout-conversion-extension',
      },
      name: deployment.metadata.name,
      namespace: namespace,
    },
    spec: {
      replicas: deployment.spec.replicas,
      revisionHistoryLimit: deployment.spec.revisionHistoryLimit,
      selector: deployment.spec.selector,
    },
  };

  // strategy 별로 spec.strategy 다르게 구성 (canary or blue/green)
  if (strategy === 'canary') {
    const canaryStrategy = {
      canaryService: canary,
      stableService: stable,
      canaryMetadata: {
        annotations: { role: 'canary' },
        labels: { role: 'canary' },
      },
      stableMetadata: {
        annotations: { role: 'stable' },
        labels: { role: 'stable' },
      },
      steps: steps || [],
      scaleDownDelaySeconds: 30,      
      abortScaleDownDelaySeconds: 30,
      dynamicStableScale: false,
    };
  
    // httpRoute가 존재할 경우에만 trafficRouting 필드 추가
    if (httpRoute) {
      canaryStrategy.trafficRouting = {
        plugins: {
          'argoproj-labs/gatewayAPI': {
            httpRoute: httpRoute,
            namespace: namespace,
          },
        },
      };
    }
  
    rolloutTemplate.spec.strategy = {
      canary: canaryStrategy,
    };
  } else if (strategy === 'blueGreen') {
    const blueGreenStrategy = {
      activeService: 'stable-service',
      previewService: 'bluegreen-service',
      autoPromotionEnabled: false,
      scaleDownDelaySeconds: 30,
      abortScaleDownDelaySeconds: 30,
      activeMetadata: {
        labels: { role: 'stable' },
      },
      previewMetadata: {
        labels: { role: 'bluegreen' },
      },
    };
  
    rolloutTemplate.spec.strategy = {
      blueGreen: blueGreenStrategy,
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