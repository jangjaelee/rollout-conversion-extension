// src/utils/serviceDuplicate.js

export const duplicateServiceForCanary = (service) => {
    if (!service) return { stable: null, canary: null };
  
    const stable = JSON.parse(JSON.stringify(service));
    const canary = JSON.parse(JSON.stringify(service));
  
    // canary 이름만 변경
    canary.metadata.name = `${service.metadata.name}-canary`;
  
    return { stable, canary };
  };