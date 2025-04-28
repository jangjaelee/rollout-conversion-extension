// src/utils/addCanaryToHttpRoute.js

export const addCanaryBackendToHTTPRoute = (httpRoute) => {
    if (!httpRoute || httpRoute.kind !== 'HTTPRoute') {
      console.error('Provided resource is not a valid HTTPRoute.');
      return null;
    }
  
    // Deep Copy 방지용 안전 복사
    const updatedRoute = JSON.parse(JSON.stringify(httpRoute));
  
    // rules가 없으면 그냥 반환
    if (!Array.isArray(updatedRoute.spec?.rules)) {
      console.error('HTTPRoute has no rules.');
      return updatedRoute;
    }
  
    updatedRoute.spec.rules.forEach((rule) => {
      if (!Array.isArray(rule.backendRefs)) {
        rule.backendRefs = [];
      }
  
      // 이미 canary backend가 있는지 체크 (중복 방지)
      const hasCanary = rule.backendRefs.some(ref => ref.name.endsWith('-canary'));
      if (!hasCanary) {
        // 첫 번째 backend를 기준으로 port 복사
        const baseBackend = rule.backendRefs[0];
        if (baseBackend) {
          rule.backendRefs.push({
            kind: 'Service',
            name: `${baseBackend.name}-canary`,
            port: baseBackend.port,
          });
        }
      }
    });

    // rollout-conversion-extension으로 변환되었다는 표시 추가
    updateRoute.metadata.labels = {
        ...(updateRoute.metadata.labels || {}),  // 기존 labels 유지
        'converted-by': 'rollout-conversion-extension', // 변환 표시 추가
      };    
  
    return updatedRoute;
  };