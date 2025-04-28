// src/utils/serviceDuplicate.js

export const duplicateServiceForCanary = (service) => {
    if (!service) return { stable: null, canary: null };
  
    const stable = JSON.parse(JSON.stringify(service));
    const canary = JSON.parse(JSON.stringify(service));
  
    // canary service의 이름만 변경
    canary.metadata.name = `${service.metadata.name}-canary`;

    // rollout-conversion-extension으로 변환되었다는 표시 추가
    canary.metadata.labels = {
      ...(canary.metadata.labels || {}),  // 기존 labels 유지
      'converted-by': 'rollout-conversion-extension', // 변환 표시 추가
    };

    return { stable, canary };
  };