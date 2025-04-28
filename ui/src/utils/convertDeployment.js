// src/utils/convertDeployment.js

// Rollout API Template
const convertDeploymentToRollout = ({ deployment, steps, mode }) => {
  //const { deployment, steps } = props;
  if (!deployment || !steps) return null;

  const rolloutCanaryTemplate = {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Rollout',
    metadata: {
      name: deployment.metadata.name,
      namespace: deployment.metadata.namespace,
      labels: deployment.metadata.labels,
      annotations: deployment.metadata.annotations,
    },
    spec: {
      replicas: deployment.spec.replicas,
      revisionHistoryLimit: deployment.spec.revisionHistoryLimit,
      strategy: {
        canary: {
          canaryService: 'canary-service',
          stableService: 'stable-service',
          canaryMetadata: {
            annotations: {
              role: 'canary',
            },
            labels: {
              role: 'canary',
            },
          },
          stableMetadata: {
            annotations: {
              role: 'stable',
            },
            labels: {
              role: 'stable',
            },
          },
          steps: steps,
        },
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
      selector: deployment.spec.selector,
    },
  };

  if (mode === 'workloadRef') {

    rolloutCanaryTemplate.spec.workloadRef = {
        apiVersion: deployment.apiVersion,
        kind: deployment.kind,
        name: deployment.metadata.name,
        scaleDown: "onsuccess",
    };
  } else {
    //rolloutCanaryTemplate.spec.selector = deployment.spec.selector;
    rolloutCanaryTemplate.spec.template = deployment.spec.template;
  }

  return rolloutCanaryTemplate;
};