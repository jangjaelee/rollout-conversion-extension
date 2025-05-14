// src/utils/addCanaryToHttpRoute.js

export const addBackendToHTTPRoute = (httpRoute, serviceName) => {
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
      return { updatedRoute: null, duplicate: false };
    }

    updatedRoute.spec.rules.forEach((rule) => {
      if (!Array.isArray(rule.backendRefs)) {
        rule.backendRefs = [];
      }
  
      // 이미 preview 또는 canary backend가 있는지 체크 (중복 방지)
      const alreadyExists = rule.backendRefs.some((ref) => ref.name === serviceName);
      if (alreadyExists) {
        duplicate = true;
        return;
      }

      //if (!alreadyExists) {
        // 기존 포트 기준으로 새 서비스 추가
        const basePort = rule.backendRefs[0]?.port || { number: 80 };
        rule.backendRefs.push({
          kind: 'Service',
          name: serviceName,
          port: basePort,
        });
      //}
    });

  return { updatedRoute, duplicate };
};