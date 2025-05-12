// src/utils/createAnalysisTemplate.js

export const createAnalysisTemplate = ({ name, namespace }) => {
    const templateName = `${name}-analysis-template`;
  
    return {
      apiVersion: 'argoproj.io/v1alpha1',
      kind: 'AnalysisTemplate',
      metadata: {
        labels: {
          'created-by': 'rollout-conversion-extension',
        },
        name: templateName,
        namespace: namespace,
      },
      spec: {
        args: [
        {
          name: 'service-name',
        },
        {
          name: 'prometheus-address',
          value: 'http://mimir-proxy.mimir/prometheus',
        },
      ],
      metrics: [
        {
          name: 'success-rate',
          interval: '30s',
          count: 3,
          successCondition: 'result[0] >= 0.95',
          failureLimit: 3,
          inconclusiveLimit: 1,
          provider: {
            prometheus: {
              address: '{{args.prometheus-address}}',
              query: `
                sum(rate(
                  istio_requests_total{
                    reporter="source",
                    destination_service=~"{{args.service-name}}",
                    response_code!~"5.*"
                  }[5m]
                )) /
                sum(rate(
                  istio_requests_total{
                    reporter="source",
                    destination_service=~"{{args.service-name}}"
                  }[5m]
                ))`,
            },
          },
        },
      ],
    },
  };
};