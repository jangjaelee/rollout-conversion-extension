// src/utils/convertAutoscalers.js

const applyRolloutTargetPatch = (resource) => {
    const updated = JSON.parse(JSON.stringify(resource));
    updated.spec.scaleTargetRef.apiVersion = 'argoproj.io/v1alpha1';
    updated.spec.scaleTargetRef.kind = 'Rollout';
    updated.metadata.labels = {
      ...(updated.metadata.labels || {}),
      'converted-by': 'rollout-conversion-extension',
    };
    
    return updated;
};

export const convertScaledObject = (resource) => {
    const kind = resource.spec?.scaleTargetRef?.kind;
  
    if (kind === 'Rollout') {
      return { converted: null, isAlreadyRolloutTarget: true };
    }
  
    if (kind === 'Deployment') {
      return {
        converted: applyRolloutTargetPatch(resource),
        isAlreadyRolloutTarget: false,
      };
    }
  
    return { converted: null, isAlreadyRolloutTarget: false };
  };
  
export const convertHPA = (resource) => {
    const kind = resource.spec?.scaleTargetRef?.kind;
    const isFromKeda = !!resource.metadata?.labels?.['scaledobject.keda.sh/name'];
  
    if (isFromKeda) {
      return { converted: null, isKedaBased: true };
    }
  
    if (kind === 'Deployment') {
      return {
        converted: applyRolloutTargetPatch(resource),
        isKedaBased: false,
      };
    }
  
    return { converted: null, isKedaBased: false };
};