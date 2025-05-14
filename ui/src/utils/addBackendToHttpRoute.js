// src/utils/addCanaryToHttpRoute.js

export const addBackendToHTTPRoute = (httpRoute, selectedServiceName) => {
    let duplicate = false;

    if (!httpRoute || httpRoute.kind !== 'HTTPRoute') {
      console.error('Provided resource is not a valid HTTPRoute.');
      return { updatedRoute: null, duplicate };
    }
  
    // Deep Copy 방지용 안전 복사
    const updatedRoute = JSON.parse(JSON.stringify(httpRoute));

    // rollout-conversion-extension으로 변환되었다는 표시 추가
    updatedRoute.metadata.labels = {
        ...(updatedRoute.metadata.labels || {}),
        'converted-by': 'rollout-conversion-extension',
    };

    // rules가 없으면 그냥 반환
    if (!Array.isArray(updatedRoute.spec?.rules)) {
      console.error('HTTPRoute has no rules.');
      return { updatedRoute, duplicate };
    }

    updatedRoute.spec.rules.forEach((rule) => {
      if (!Array.isArray(rule.backendRefs)) {
        rule.backendRefs = [];
      }
  
      // 이미 canary 또는 preview service의 backend가 있는지 체크 (중복 방지)
      const hasSelected = rule.backendRefs.some(ref => ref.name === selectedServiceName);
      if (hasSelected) {
        duplicate = true;
        return;
      }

      if (!hasSelected) {
        // 첫 번째 backend를 기준으로 port 복사
        const baseBackend = rule.backendRefs[0];
        if (baseBackend) {
          rule.backendRefs.push({
            kind: 'Service',
            name: selectedServiceName,
            port: baseBackend?.port,
          });
        }
      }
    });

  return { updatedRoute, duplicate };
};