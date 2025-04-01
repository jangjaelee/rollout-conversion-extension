import * as React from 'react';
import { useMemo } from 'react';
import jsyaml from 'js-yaml';
import './index.css';

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
    
    return createElement('div', { className: 'container' }, [
      createElement('div', {}, [
        createElement('h3', {}, 'Live Resource'),
        createElement('pre', { className: 'yaml-box' }, liveYaml),
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