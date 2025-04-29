// src/utils/createAnalysisTemplate.js

export const createAnalysisTemplate = ({ name, namespace }) => {
    const templateName = `${name}-analysis-template`;
  
    return {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'AnalysisTemplate',
      metadata: {
        name: templateName,
        namespace: namespace,
        labels: {
          'created-by': 'rollout-conversion-extension',
        },
      },
      spec: {
        metrics: [
          {
            name: 'success-rate',
            interval: '30s',
            count: 3,
            successCondition: "result.status == 'Success'",
            failureLimit: 1,
            provider: {
              prometheus: {
                address: 'http://prometheus-operated.monitoring.svc:9090', // 수정 가능
                query: 'sum(rate(http_requests_total{status=~"5.."}[2m])) / sum(rate(http_requests_total[2m])) < 0.05',
              },
            },
          },
        ],
      },
    };
  };