import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import jsyaml from 'js-yaml';

((window) => {
  const { createElement } = React;

  const DeploymentYamlViewer = ({ resource }) => {
    const yamlText = useMemo(() => {
      if (!resource) {
        return "# No resource data available"; // null 또는 undefined 체크
      }
      try {
        return jsyaml.dump(resource);
      } catch (e) {
        return "# Error converting resource to YAML";
      }
    }, [resource]);

    return createElement(
      'pre',
      {
        style: {
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace',
          backgroundColor: '#f0f0f0',
          padding: '1rem',
          borderRadius: '6px'
        }
      },
      yamlText
    );
  };

  // "apps/Deployment" 리소스에 대해 탭 추가
  window.extensionsAPI?.registerResourceExtension?.(
    DeploymentYamlViewer,
    'apps',
    'Deployment',
    'YAML Viewer'
  );
})(window);