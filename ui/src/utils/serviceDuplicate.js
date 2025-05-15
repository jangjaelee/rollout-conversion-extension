// src/utils/serviceDuplicate.js

export const duplicateServiceWithSuffix = (service, suffix) => {
    if (!service || !suffix) return { original: null, duplicated: null };

    const original = JSON.parse(JSON.stringify(service));
    const duplicated = JSON.parse(JSON.stringify(service));
    const originalName = original.metadata.name;

    duplicated.metadata.name = originalName.endsWith(suffix) ? originalName : `${originalName}${suffix}`;

    // rollout-conversion-extension으로 변환되었다는 표시 추가
    duplicated.metadata.labels = {
      ...(duplicated.metadata.labels || {}),
      'converted-by': 'rollout-conversion-extension',
    };

    return { original, duplicated };
};

export const useIsRolloutManagedService = (resource) => {
  if (resource?.kind !== 'Service') return false;

  const selector = resource?.spec?.selector;
  return (
    selector &&
    Object.prototype.hasOwnProperty.call(selector, 'rollouts-pod-template-hash')
  );
};