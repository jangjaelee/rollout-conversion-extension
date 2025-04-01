import * as React from 'react';
import { useMemo } from 'react';
import jsyaml from 'js-yaml';

((window) => {
  const { createElement } = React;

  const DeploymentYamlViewer = ({ resource }) => {
    const liveYaml = useMemo(() => {
      if (!resource) return "# No live resource available";
      try {
        return jsyaml.dump(resource);
      } catch {
        return "# Error converting live resource to YAML";
      }
    }, [resource]);

    const containerStyle = {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem',
      fontFamily: 'monospace',
    };

    const yamlBoxStyle = {
      whiteSpace: 'pre-wrap',
      backgroundColor: '#f0f0f0',
      padding: '1rem',
      borderRadius: '6px',
      overflowX: 'auto'
    };

    return createElement('div', { style: containerStyle }, [
      createElement('div', {}, [
        createElement('h3', {}, 'Live Resource'),
        createElement('pre', { style: yamlBoxStyle }, liveYaml),
      ])
    ]);
  };

  window.extensionsAPI?.registerResourceExtension?.(
    DeploymentYamlViewer,
    'apps',
    'Deployment',
    'YAML Viewer'
  );
})(window);