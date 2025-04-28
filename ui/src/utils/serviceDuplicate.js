// src/utils/serviceDuplicate.js

export const duplicateServiceForCanary = (service) => {
    if (!service) return { stable: null, canary: null };
  
    const stable = JSON.parse(JSON.stringify(service));
    const canary = JSON.parse(JSON.stringify(service));
    const originalName = service.metadata.name;

    canary.metadata.name = `${service.metadata.name}-canary`;
    // 이름이 이미 -canary로 끝나지 않는 경우에만 이름 변경
    if (!originalName.endsWith('-canary')) {
      canary.metadata.name = `${originalName}-canary`;
    } else {
      canary.metadata.name = originalName; // 이미 canary이면 이름 유지
    }

    // rollout-conversion-extension으로 변환되었다는 표시 추가
    canary.metadata.labels = {
      ...(canary.metadata.labels || {}),  // 기존 labels 유지
      'converted-by': 'rollout-conversion-extension', // 변환 표시 추가
    };

    return { stable, canary };
  };