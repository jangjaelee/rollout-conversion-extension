// src/utils/downloadCopy.js

import yaml from 'js-yaml';

export const copyToClipboard = async (object, filenamePrefix) => {
  try {
    const yamlString = yaml.dump(object);
    await navigator.clipboard.writeText(yamlString);
    alert(`📋 ${filenamePrefix} YAML copied to clipboard!`);
  } catch (err) {
    alert('❌ Failed to copy!');
    console.error('Copy failed:', err);
  }
};

export const downloadYaml = (object, filenamePrefix) => {
  try {
    const yamlString = yaml.dump(object);
    const blob = new Blob([yamlString], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}-${object?.metadata?.name || 'resource'}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert('❌ Failed to download!');
    console.error('Download failed:', err);
  }
};