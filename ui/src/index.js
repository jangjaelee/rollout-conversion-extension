import * as React from 'react';
import { useMemo } from 'react';
import jsyaml from 'js-yaml';

((window) => {
  const { createElement } = React;

  const DeploymentYamlViewer = ({ resource, desiredResource }) => {
    const liveYaml = useMemo(() => {
      if (!resource) return "# No live resource available";
      try {
        return jsyaml.dump(resource);
      } catch {
        return "# Error converting live resource to YAML";
      }
    }, [resource]);

    const desiredYaml = useMemo(() => {
      if (!desiredResource) return "# No desired resource available";
      try {
        return jsyaml.dump(desiredResource);
      } catch {
        return "# Error converting desired resource to YAML";
      }
    }, [desiredResource]);

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
      ]),
      createElement('div', {}, [
        createElement('h3', {}, 'Desired Resource'),
        createElement('pre', { style: yamlBoxStyle }, desiredYaml),
      ]),
    ]);
  };

  window.extensionsAPI?.registerResourceExtension?.(
    DeploymentYamlViewer,
    'apps',
    'Deployment',
    'YAML Viewer',
    {
      desired: true,
    }
  );
})(window);